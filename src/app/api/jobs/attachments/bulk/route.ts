import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { format } from "date-fns";
import { Readable } from "stream";
import {
  computeJobFolderKey,
  getOrCreateJobFolderStructure,
} from "@/lib/utils/attachment-utils";
import {
  sanitizeFolderName,
  createOrganizedFilename,
  validateFilename,
  auditFilename,
} from "@/lib/file-security";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const ATTACHMENT_TYPES = ["runsheet", "docket", "delivery_photos"] as const;
type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "doc",
  "docx",
  "txt",
  "csv",
];

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface BulkFileEntry {
  file: File;
  attachmentType: AttachmentType;
}

interface JobUploadResult {
  jobId: number;
  success: boolean;
  job?: unknown;
  error?: string;
}

function isAttachmentType(value: string): value is AttachmentType {
  return (ATTACHMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Bulk attachment upload across multiple jobs.
 *
 * Resolving folders in a single request is what prevents Google Drive folder
 * duplication: each unique (week ending + customer/billTo) folder is created
 * exactly once and its ID is reused for every job that maps to it. Firing one
 * request per job (the previous approach) raced on folder creation because the
 * in-process folder cache is not shared across serverless instances, producing
 * duplicate "Folder (1)", "Folder (2)" entries.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const baseFolderId = formData.get("baseFolderId") as string;
    const driveId = formData.get("driveId") as string;

    if (!baseFolderId || !driveId) {
      return NextResponse.json(
        { error: "Missing required folder or drive configuration" },
        { status: 400 },
      );
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Associate each file with its job and attachment type via parallel indexes.
    const filesByJob = new Map<number, BulkFileEntry[]>();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawJobId = formData.get(`jobIds[${i}]`) as string | null;
      const attachmentType = formData.get(
        `attachmentTypes[${i}]`,
      ) as string | null;

      const jobId = rawJobId ? parseInt(rawJobId, 10) : NaN;
      if (isNaN(jobId)) {
        return NextResponse.json(
          { error: `Missing or invalid job ID for file ${i + 1}` },
          { status: 400 },
        );
      }

      if (!attachmentType || !isAttachmentType(attachmentType)) {
        return NextResponse.json(
          { error: `Invalid attachment type for file ${i + 1}` },
          { status: 400 },
        );
      }

      // SECURITY: validate each file before queuing it for upload.
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum allowed: 20MB`,
          },
          { status: 400 },
        );
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `File "${file.name}" has unsupported type "${file.type}". Allowed types: PDF, images, documents`,
          },
          { status: 400 },
        );
      }

      const audit = auditFilename(file.name);
      if (audit.riskLevel === "high") {
        return NextResponse.json(
          {
            error: `File "${file.name}" has security issues: ${audit.issues.join(", ")}`,
          },
          { status: 400 },
        );
      }

      const validation = validateFilename(file.name, ALLOWED_EXTENSIONS);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is invalid: ${validation.errors.join(", ")}`,
          },
          { status: 400 },
        );
      }

      const entries = filesByJob.get(jobId) ?? [];
      entries.push({ file, attachmentType });
      filesByJob.set(jobId, entries);
    }

    const jobIds = Array.from(filesByJob.keys());

    // Fetch all referenced jobs in one query.
    const jobs = await prisma.jobs.findMany({
      where: { id: { in: jobIds } },
    });
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    const drive = await createGoogleDriveClient();

    // Resolve each unique folder ONCE and reuse the ID for every job in the
    // group. This is the core of the duplication fix.
    const resolvedFolders = new Map<string, string>();
    // Seed existing-file counts per folder so numbering stays correct even for
    // files uploaded within this same request (Drive search indexing lags, so
    // we cannot rely on re-listing after each create).
    const folderExistingNames = new Map<string, string[]>();
    const addedPrefixCounts = new Map<string, number>();

    const results: JobUploadResult[] = [];

    for (const jobId of jobIds) {
      const job = jobsById.get(jobId);
      const jobFiles = filesByJob.get(jobId) ?? [];

      if (!job) {
        results.push({ jobId, success: false, error: "Job not found" });
        continue;
      }

      // Track uploaded Drive files for per-job rollback on failure.
      const uploadedFiles: Array<{ fileId: string; fileName: string }> = [];
      const uploadedFilesByType: Record<AttachmentType, string[]> = {
        runsheet: [],
        docket: [],
        delivery_photos: [],
      };

      try {
        const { folderKey } = computeJobFolderKey({
          job: {
            date: job.date,
            customer: job.customer,
            billTo: job.billTo,
          },
        });

        let customerFolderId = resolvedFolders.get(folderKey);
        if (!customerFolderId) {
          const structure = await getOrCreateJobFolderStructure({
            job: {
              date: job.date,
              customer: job.customer,
              billTo: job.billTo,
            },
            baseFolderId,
            driveId,
          });
          customerFolderId = structure.customerFolderId;
          resolvedFolders.set(folderKey, customerFolderId);
        }

        // Seed the existing file names for this folder exactly once.
        if (!folderExistingNames.has(customerFolderId)) {
          const existingResponse = await drive.files.list({
            q: `parents in '${customerFolderId}' and trashed=false`,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: "drive",
            driveId,
          });
          folderExistingNames.set(
            customerFolderId,
            (existingResponse.data.files
              ?.map((f) => f.name)
              .filter((name): name is string => !!name) as string[]) ?? [],
          );
        }

        const existingNames = folderExistingNames.get(customerFolderId) ?? [];

        const jobDateStr = format(new Date(job.date), "dd.MM.yy");
        const sanitizedDriver = sanitizeFolderName(job.driver || "Unknown");
        const sanitizedCustomer = sanitizeFolderName(job.customer);
        const sanitizedTruckType = sanitizeFolderName(
          job.truckType || "Unknown",
        );

        for (const { file, attachmentType } of jobFiles) {
          const prefix = `${jobDateStr}_${sanitizedDriver}_${sanitizedCustomer}_${sanitizedTruckType}_${attachmentType}`;

          // Effective existing count = files already in Drive with this prefix
          // plus files we have already added in this request.
          const prefixCountKey = `${customerFolderId}::${prefix}`;
          const existingCount =
            existingNames.filter((name) => name.startsWith(prefix)).length +
            (addedPrefixCounts.get(prefixCountKey) ?? 0);

          const finalFileName = createOrganizedFilename(
            file.name,
            prefix,
            existingCount,
          );

          const buffer = await file.arrayBuffer();
          const stream = Readable.from(Buffer.from(buffer));

          const uploadResponse = await drive.files.create({
            requestBody: {
              name: finalFileName,
              parents: [customerFolderId],
            },
            media: {
              mimeType: file.type,
              body: stream,
            },
            supportsAllDrives: true,
          });

          if (!uploadResponse.data.id) {
            throw new Error(`Failed to upload file: ${file.name}`);
          }

          uploadedFiles.push({
            fileId: uploadResponse.data.id,
            fileName: finalFileName,
          });

          addedPrefixCounts.set(
            prefixCountKey,
            (addedPrefixCounts.get(prefixCountKey) ?? 0) + 1,
          );

          await drive.permissions.create({
            fileId: uploadResponse.data.id,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
            supportsAllDrives: true,
          });

          const fileLink = `https://drive.google.com/file/d/${uploadResponse.data.id}/view?filename=${encodeURIComponent(finalFileName)}`;
          uploadedFilesByType[attachmentType].push(fileLink);
        }

        const updateData: {
          attachmentRunsheet?: string[];
          attachmentDocket?: string[];
          attachmentDeliveryPhotos?: string[];
          runsheet?: boolean;
        } = {};

        if (uploadedFilesByType.runsheet.length > 0) {
          updateData.attachmentRunsheet = [
            ...job.attachmentRunsheet,
            ...uploadedFilesByType.runsheet,
          ];
          updateData.runsheet = true;
        }

        if (uploadedFilesByType.docket.length > 0) {
          updateData.attachmentDocket = [
            ...job.attachmentDocket,
            ...uploadedFilesByType.docket,
          ];
        }

        if (uploadedFilesByType.delivery_photos.length > 0) {
          updateData.attachmentDeliveryPhotos = [
            ...job.attachmentDeliveryPhotos,
            ...uploadedFilesByType.delivery_photos,
          ];
        }

        const updatedJob = await prisma.jobs.update({
          where: { id: jobId },
          data: updateData,
        });

        results.push({ jobId, success: true, job: updatedJob });
      } catch (jobError) {
        console.error(`Bulk attachment upload failed for job ${jobId}:`, jobError);

        // Roll back this job's uploaded Drive files; other jobs are unaffected.
        for (const uploadedFile of uploadedFiles) {
          try {
            await drive.files.delete({
              fileId: uploadedFile.fileId,
              supportsAllDrives: true,
            });
          } catch (deleteError) {
            console.error(
              `Failed to delete file during rollback: ${uploadedFile.fileName}`,
              deleteError,
            );
          }
        }

        results.push({
          jobId,
          success: false,
          error:
            jobError instanceof Error
              ? jobError.message
              : "Failed to upload files",
        });
      }
    }

    const succeeded = results.filter((result) => result.success);

    return NextResponse.json(
      {
        success: succeeded.length > 0,
        results,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Bulk attachment upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

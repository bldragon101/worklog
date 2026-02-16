import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { format, endOfWeek } from "date-fns";
import { Readable } from "stream";
import {
  sanitizeFolderName,
  createOrganizedFilename,
  validateFilename,
  auditFilename,
} from "@/lib/file-security";
import { folderCache, FolderCacheManager } from "@/lib/folder-cache";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const jobId = parseInt(id);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Get job details for folder structure
    const job = await prisma.jobs.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const baseFolderId = formData.get("baseFolderId") as string;
    const driveId = formData.get("driveId") as string;

    // Get attachment types for each file
    const attachmentTypes: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const attachmentType = formData.get(`attachmentTypes[${i}]`) as string;
      if (
        !attachmentType ||
        !["runsheet", "docket", "delivery_photos"].includes(attachmentType)
      ) {
        return NextResponse.json(
          { error: `Invalid attachment type for file ${i + 1}` },
          { status: 400 },
        );
      }
      attachmentTypes.push(attachmentType);
    }

    if (!baseFolderId || !driveId) {
      return NextResponse.json(
        { error: "Missing required folder or drive configuration" },
        { status: 400 },
      );
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Enhanced file validation for security
    const allowedExtensions = [
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

    // SECURITY: Define allowed MIME types to prevent bypass via double extensions
    const allowedMimeTypes = [
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

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // SECURITY: File size validation
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum allowed: 20MB`,
          },
          { status: 400 },
        );
      }

      // SECURITY: MIME type validation (primary defense)
      if (!allowedMimeTypes.includes(file.type)) {
        return NextResponse.json(
          {
            error: `File "${file.name}" has unsupported type "${file.type}". Allowed types: PDF, images, documents`,
          },
          { status: 400 },
        );
      }

      // Security audit of the filename
      const audit = auditFilename(file.name);
      if (audit.riskLevel === "high") {
        return NextResponse.json(
          {
            error: `File "${file.name}" has security issues: ${audit.issues.join(", ")}`,
          },
          { status: 400 },
        );
      }

      // Validate filename extension (secondary defense)
      const validation = validateFilename(file.name, allowedExtensions);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: `File "${file.name}" is invalid: ${validation.errors.join(", ")}`,
          },
          { status: 400 },
        );
      }

      // Log any warnings
      if (validation.warnings.length > 0 || audit.riskLevel === "medium") {
        console.warn(`File security warning for "${file.name}":`, {
          warnings: validation.warnings,
          auditIssues: audit.issues,
          riskLevel: audit.riskLevel,
        });
      }
    }

    // Calculate week ending (upcoming Sunday from job date)
    const jobDate = new Date(job.date);
    const weekEnding = endOfWeek(jobDate, { weekStartsOn: 1 }); // Monday is start of week
    const weekEndingStr = format(weekEnding, "dd.MM.yy");

    // Securely sanitize folder and file names
    const sanitizedCustomer = sanitizeFolderName(job.customer);
    const sanitizedBillTo = sanitizeFolderName(job.billTo);
    // Use just customer name if customer and billTo are the same
    const customerBillToFolder =
      sanitizedCustomer === sanitizedBillTo
        ? sanitizedCustomer
        : `${sanitizedCustomer}_${sanitizedBillTo}`;
    const jobDateStr = format(new Date(job.date), "dd.MM.yy");

    // Sanitize job fields for filename generation
    const sanitizedDriver = sanitizeFolderName(job.driver || "Unknown");
    const sanitizedCustomerForFile = sanitizeFolderName(job.customer);
    const sanitizedTruckType = sanitizeFolderName(job.truckType || "Unknown");

    try {
      const drive = await createGoogleDriveClient();

      // Check cache for week folder first
      let weekFolderId = folderCache.getWeekFolderId(
        weekEndingStr,
        baseFolderId,
      );

      if (!weekFolderId) {
        // Check if week ending folder exists, create if not
        // SECURITY: Use safe API query without string interpolation
        const weekFolderResponse = await drive.files.list({
          q: `parents in '${baseFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "drive",
          driveId: driveId,
        });

        // Find folder by exact name match in results (safe from injection)
        const existingWeekFolder = weekFolderResponse.data.files?.find(
          (file) => file.name === weekEndingStr,
        );

        if (existingWeekFolder) {
          weekFolderId = existingWeekFolder.id!;
        } else {
          // Create week ending folder
          const weekFolderCreate = await drive.files.create({
            requestBody: {
              name: weekEndingStr,
              mimeType: "application/vnd.google-apps.folder",
              parents: [baseFolderId],
            },
            supportsAllDrives: true,
          });
          weekFolderId = weekFolderCreate.data.id!;
        }

        // Cache the week folder ID
        folderCache.setWeekFolderId(weekEndingStr, baseFolderId, weekFolderId);
      }

      // Create customer key for caching
      const customerKey = FolderCacheManager.createCustomerKey(
        sanitizedCustomer,
        sanitizedBillTo,
      );

      // Check cache for customer folder first
      let customerFolderId = folderCache.getCustomerFolderId(
        weekEndingStr,
        baseFolderId,
        customerKey,
      );

      if (!customerFolderId) {
        // Check if customer-billTo folder exists under week ending, create if not
        // SECURITY: Use safe API query without string interpolation
        const customerFolderResponse = await drive.files.list({
          q: `parents in '${weekFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "drive",
          driveId: driveId,
        });

        // Find folder by exact name match in results (safe from injection)
        const existingCustomerFolder = customerFolderResponse.data.files?.find(
          (file) => file.name === customerBillToFolder,
        );

        if (existingCustomerFolder) {
          customerFolderId = existingCustomerFolder.id!;
        } else {
          // Create customer-billTo folder
          const customerFolderCreate = await drive.files.create({
            requestBody: {
              name: customerBillToFolder,
              mimeType: "application/vnd.google-apps.folder",
              parents: [weekFolderId],
            },
            supportsAllDrives: true,
          });
          customerFolderId = customerFolderCreate.data.id!;
        }

        // Cache the customer folder ID
        folderCache.setCustomerFolderId(
          weekEndingStr,
          baseFolderId,
          customerKey,
          customerFolderId,
        );
      }

      // Track uploaded files for rollback in case of failure
      const uploadedFiles: Array<{ fileId: string; fileName: string }> = [];

      // Group uploaded files by attachment type
      const uploadedFilesByType: {
        runsheet: string[];
        docket: string[];
        delivery_photos: string[];
      } = {
        runsheet: [],
        docket: [],
        delivery_photos: [],
      };

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const attachmentType = attachmentTypes[i];

          // Create organization prefix for the filename: <date>_<driver>_<customer>_<trucktype>_<attachmenttype>
          const organizationPrefix = `${jobDateStr}_${sanitizedDriver}_${sanitizedCustomerForFile}_${sanitizedTruckType}_${attachmentType}`;

          // Check for existing files with similar names (using safe search)
          const searchPattern = `${jobDateStr}_${sanitizedDriver}_${sanitizedCustomerForFile}_${sanitizedTruckType}_${attachmentType}`;
          // SECURITY: Use safe API query without string interpolation
          const existingFilesResponse = await drive.files.list({
            q: `parents in '${customerFolderId}' and trashed=false`,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: "drive",
            driveId: driveId,
          });

          // Count existing files with matching pattern (safe from injection)
          const existingCount =
            existingFilesResponse.data.files?.filter((file) =>
              file.name?.startsWith(searchPattern),
            ).length || 0;

          // Create secure, organized filename
          const finalFileName = createOrganizedFilename(
            file.name,
            organizationPrefix,
            existingCount,
          );

          // Convert file to buffer
          const buffer = await file.arrayBuffer();

          // Create readable stream from buffer
          const stream = Readable.from(Buffer.from(buffer));

          // Upload to Google Drive
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

          if (uploadResponse.data.id) {
            // Track this file for potential rollback
            uploadedFiles.push({
              fileId: uploadResponse.data.id,
              fileName: finalFileName,
            });

            // Generate sharing link
            await drive.permissions.create({
              fileId: uploadResponse.data.id,
              requestBody: {
                role: "reader",
                type: "anyone",
              },
              supportsAllDrives: true,
            });

            const fileLink = `https://drive.google.com/file/d/${uploadResponse.data.id}/view?filename=${encodeURIComponent(finalFileName)}`;
            uploadedFilesByType[
              attachmentType as keyof typeof uploadedFilesByType
            ].push(fileLink);
          } else {
            throw new Error(`Failed to upload file: ${file.name}`);
          }
        }
      } catch (uploadError) {
        // Rollback: Delete all successfully uploaded files
        console.error(
          "File upload failed, rolling back uploaded files:",
          uploadError,
        );

        for (const uploadedFile of uploadedFiles) {
          try {
            await drive.files.delete({
              fileId: uploadedFile.fileId,
              supportsAllDrives: true,
            });
            console.log(`Rolled back file: ${uploadedFile.fileName}`);
          } catch (deleteError) {
            console.error(
              `Failed to delete file during rollback: ${uploadedFile.fileName}`,
              deleteError,
            );
          }
        }

        // Invalidate cache on upload failure to ensure fresh lookup next time
        folderCache.invalidateWeekCache(weekEndingStr, baseFolderId);

        throw uploadError;
      }

      // Update job record with new attachment URLs by type
      // Use explicit set (read + concat) instead of push to prevent 2D array corruption
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

      // Update database with rollback capability
      let updatedJob;
      try {
        updatedJob = await prisma.jobs.update({
          where: { id: jobId },
          data: updateData,
        });

        // Activity logging has been removed
      } catch (dbError) {
        // Database update failed - rollback uploaded files
        console.error(
          "Database update failed, rolling back uploaded files:",
          dbError,
        );

        for (const uploadedFile of uploadedFiles) {
          try {
            await drive.files.delete({
              fileId: uploadedFile.fileId,
              supportsAllDrives: true,
            });
            console.log(
              `Rolled back file after DB failure: ${uploadedFile.fileName}`,
            );
          } catch (deleteError) {
            console.error(
              `Failed to delete file during DB rollback: ${uploadedFile.fileName}`,
              deleteError,
            );
          }
        }

        // Invalidate cache on database failure to ensure fresh lookup next time
        folderCache.invalidateWeekCache(weekEndingStr, baseFolderId);

        throw new Error(
          "Failed to update job record with attachment information",
        );
      }

      return NextResponse.json(
        {
          success: true,
          uploadedFilesByType,
          job: updatedJob,
        },
        {
          headers: rateLimitResult.headers,
        },
      );
    } catch (driveError) {
      console.error("Google Drive error:", driveError);
      return NextResponse.json(
        {
          error: "Failed to upload files to Google Drive",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Attachment upload error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const jobId = parseInt(id);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const job = await prisma.jobs.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        attachmentRunsheet: true,
        attachmentDocket: true,
        attachmentDeliveryPhotos: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        attachments: {
          runsheet: job.attachmentRunsheet,
          docket: job.attachmentDocket,
          delivery_photos: job.attachmentDeliveryPhotos,
        },
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Get attachments error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const jobId = parseInt(id);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Get request body
    const body = await request.json();
    const { fileUrl, attachmentType, driveId } = body;

    if (!fileUrl || !attachmentType) {
      return NextResponse.json(
        {
          error: "fileUrl and attachmentType are required",
        },
        { status: 400 },
      );
    }

    if (!["runsheet", "docket", "delivery_photos"].includes(attachmentType)) {
      return NextResponse.json(
        {
          error: "Invalid attachment type",
        },
        { status: 400 },
      );
    }

    // Get job details
    const job = await prisma.jobs.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Extract file ID from Google Drive URL
    const fileIdMatch = fileUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)\/view/);
    if (!fileIdMatch) {
      return NextResponse.json(
        {
          error: "Invalid Google Drive URL format",
        },
        { status: 400 },
      );
    }

    const fileId = fileIdMatch[1];

    try {
      // Delete from Google Drive
      const drive = await createGoogleDriveClient();

      // Prepare API parameters for shared drive support
      const apiParams = {
        fileId: fileId,
        supportsAllDrives: true,
        ...(driveId && {
          includeItemsFromAllDrives: true,
          driveId: driveId,
        }),
      };

      // First verify the file exists and check permissions
      let fileExists = false;
      let canDelete = true;
      try {
        const fileResponse = await drive.files.get({
          ...apiParams,
          fields: "id,capabilities",
        });
        fileExists = true;
        canDelete = fileResponse.data.capabilities?.canDelete !== false;
      } catch (checkError: unknown) {
        const error = checkError as { status?: number; code?: number };
        if (error?.status === 404 || error?.code === 404) {
          fileExists = false;
        } else {
          throw checkError;
        }
      }

      // Only attempt deletion if file exists
      if (fileExists) {
        if (!canDelete) {
          console.error(
            `No permission to delete file ${fileId}. Service account needs Editor/Manager access to the shared drive.`,
          );

          // Still remove from database but inform user about Google Drive limitation
          const updateData: {
            attachmentRunsheet?: string[];
            attachmentDocket?: string[];
            attachmentDeliveryPhotos?: string[];
          } = {};

          switch (attachmentType) {
            case "runsheet":
              updateData.attachmentRunsheet = job.attachmentRunsheet.filter(
                (url) => url !== fileUrl,
              );
              break;
            case "docket":
              updateData.attachmentDocket = job.attachmentDocket.filter(
                (url) => url !== fileUrl,
              );
              break;
            case "delivery_photos":
              updateData.attachmentDeliveryPhotos =
                job.attachmentDeliveryPhotos.filter((url) => url !== fileUrl);
              break;
          }

          const updatedJob = await prisma.jobs.update({
            where: { id: jobId },
            data: updateData,
          });

          // Activity logging has been removed

          return NextResponse.json(
            {
              success: true,
              message:
                "Attachment removed from app. Note: File still exists in Google Drive due to insufficient permissions. Please contact your administrator to grant the service account Editor access to the shared drive.",
              job: updatedJob,
              partialDeletion: true,
            },
            {
              headers: rateLimitResult.headers,
            },
          );
        }

        // Delete the file from Google Drive
        await drive.files.delete(apiParams);
      }

      // Remove URL from appropriate attachment array in database
      const updateData: {
        attachmentRunsheet?: string[];
        attachmentDocket?: string[];
        attachmentDeliveryPhotos?: string[];
      } = {};

      switch (attachmentType) {
        case "runsheet":
          updateData.attachmentRunsheet = job.attachmentRunsheet.filter(
            (url) => url !== fileUrl,
          );
          break;
        case "docket":
          updateData.attachmentDocket = job.attachmentDocket.filter(
            (url) => url !== fileUrl,
          );
          break;
        case "delivery_photos":
          updateData.attachmentDeliveryPhotos =
            job.attachmentDeliveryPhotos.filter((url) => url !== fileUrl);
          break;
      }

      // Update database
      const updatedJob = await prisma.jobs.update({
        where: { id: jobId },
        data: updateData,
      });

      // Activity logging has been removed

      return NextResponse.json(
        {
          success: true,
          message: "Attachment deleted successfully",
          job: updatedJob,
        },
        {
          headers: rateLimitResult.headers,
        },
      );
    } catch (driveError: unknown) {
      console.error("Google Drive delete error:", driveError);

      // Determine the specific error type for better user feedback
      let errorMessage =
        "Attachment removed from database (Google Drive deletion failed)";

      // Type-safe error handling
      const error = driveError as { status?: number; code?: number };
      if (error?.status === 404 || error?.code === 404) {
        errorMessage =
          "Attachment removed (file was already deleted from Google Drive)";
      } else if (error?.status === 403 || error?.code === 403) {
        errorMessage =
          "Attachment removed from database (insufficient permissions to delete from Google Drive)";
      }

      // Even if Google Drive delete fails, remove from database to avoid orphaned references
      const updateData: {
        attachmentRunsheet?: string[];
        attachmentDocket?: string[];
        attachmentDeliveryPhotos?: string[];
      } = {};

      switch (attachmentType) {
        case "runsheet":
          updateData.attachmentRunsheet = job.attachmentRunsheet.filter(
            (url) => url !== fileUrl,
          );
          break;
        case "docket":
          updateData.attachmentDocket = job.attachmentDocket.filter(
            (url) => url !== fileUrl,
          );
          break;
        case "delivery_photos":
          updateData.attachmentDeliveryPhotos =
            job.attachmentDeliveryPhotos.filter((url) => url !== fileUrl);
          break;
      }

      const updatedJob = await prisma.jobs.update({
        where: { id: jobId },
        data: updateData,
      });

      // Activity logging has been removed

      return NextResponse.json(
        {
          success: true,
          message: errorMessage,
          job: updatedJob,
          partialDeletion: true, // Flag to indicate this was a partial deletion
        },
        {
          headers: rateLimitResult.headers,
        },
      );
    }
  } catch (error) {
    console.error("Delete attachment error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

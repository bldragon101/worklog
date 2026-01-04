import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { syncJobAttachmentNames } from "@/lib/attachment-utils";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

async function getAttachmentConfig(): Promise<{
  baseFolderId: string;
  driveId: string;
} | null> {
  try {
    const settings = await prisma.googleDriveSettings.findFirst({
      where: {
        purpose: "job_attachments",
        isActive: true,
      },
      orderBy: [{ isGlobal: "desc" }, { createdAt: "desc" }],
    });

    if (settings) {
      return {
        baseFolderId: settings.baseFolderId,
        driveId: settings.driveId,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching attachment config:", error);
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

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
        date: true,
        driver: true,
        customer: true,
        billTo: true,
        truckType: true,
        attachmentRunsheet: true,
        attachmentDocket: true,
        attachmentDeliveryPhotos: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const hasAttachments =
      job.attachmentRunsheet.length > 0 ||
      job.attachmentDocket.length > 0 ||
      job.attachmentDeliveryPhotos.length > 0;

    if (!hasAttachments) {
      return NextResponse.json(
        {
          success: true,
          message: "No attachments to sync",
          renamed: [],
          errors: [],
        },
        { headers: rateLimitResult.headers },
      );
    }

    // Get Google Drive configuration for moving files
    const attachmentConfig = await getAttachmentConfig();

    const syncResult = await syncJobAttachmentNames({
      job,
      baseFolderId: attachmentConfig?.baseFolderId,
      driveId: attachmentConfig?.driveId,
    });

    if (syncResult.renamed.length > 0) {
      await prisma.jobs.update({
        where: { id: jobId },
        data: {
          attachmentRunsheet: syncResult.updatedUrls.attachmentRunsheet,
          attachmentDocket: syncResult.updatedUrls.attachmentDocket,
          attachmentDeliveryPhotos:
            syncResult.updatedUrls.attachmentDeliveryPhotos,
        },
      });
    }

    return NextResponse.json(
      {
        success: syncResult.success,
        message:
          syncResult.renamed.length > 0
            ? `Synced ${syncResult.renamed.length} attachment(s)${syncResult.renamed.some((r) => r.moved) ? " (some files moved to new folder)" : ""}`
            : "All attachment names are already up to date",
        renamed: syncResult.renamed,
        errors: syncResult.errors,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Attachment sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

import { prisma } from "@/lib/prisma";

export interface JobAttachmentConfig {
  baseFolderId: string;
  driveId: string;
}

/**
 * Fetches the active Google Drive configuration used for job attachments.
 * Prefers a global configuration, falling back to the most recently created
 * active one. Returns null when no active configuration exists.
 */
export async function getJobAttachmentConfig(): Promise<JobAttachmentConfig | null> {
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

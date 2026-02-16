import { NextRequest, NextResponse } from "next/server";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          error: "fileId is required",
        },
        { status: 400 },
      );
    }

    const drive = await createGoogleDriveClient();

    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: "id,name,mimeType,size,createdTime",
      supportsAllDrives: true,
    });

    return NextResponse.json(
      {
        success: true,
        fileName: fileMetadata.data.name,
        fileSize: fileMetadata.data.size,
        mimeType: fileMetadata.data.mimeType,
        fileId: fileMetadata.data.id,
        createdTime: fileMetadata.data.createdTime,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Google Drive get metadata error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get file metadata from Google Drive",
      },
      { status: 500 },
    );
  }
}

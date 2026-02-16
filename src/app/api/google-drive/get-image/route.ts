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
      fields: "id,name,mimeType,size",
      supportsAllDrives: true,
    });

    if (!fileMetadata.data.mimeType?.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: "File is not an image",
        },
        { status: 400 },
      );
    }

    const fileResponse = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      {
        responseType: "arraybuffer",
      },
    );

    const buffer = Buffer.from(fileResponse.data as ArrayBuffer);
    const base64 = buffer.toString("base64");
    const mimeType = fileMetadata.data.mimeType || "image/jpeg";
    const imageUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json(
      {
        success: true,
        imageUrl,
        fileName: fileMetadata.data.name,
        fileSize: fileMetadata.data.size,
        mimeType: fileMetadata.data.mimeType,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Google Drive get image error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get image from Google Drive",
      },
      { status: 500 },
    );
  }
}

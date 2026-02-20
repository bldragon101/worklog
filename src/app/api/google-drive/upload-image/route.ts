import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { z } from "zod";

const formFieldsSchema = z.object({
  driveId: z.string().min(1),
  folderId: z.string().min(1),
});

const rateLimit = createRateLimiter(rateLimitConfigs.upload);

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();

    const parsed = formFieldsSchema.safeParse({
      driveId: formData.get("driveId"),
      folderId: formData.get("folderId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "driveId and folderId are required",
        },
        { status: 400 },
      );
    }

    const fileEntry = formData.get("image");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No image file provided",
        },
        { status: 400 },
      );
    }

    const { folderId } = parsed.data;
    const file = fileEntry;

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: "File must be an image",
        },
        { status: 400 },
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File size must be less than 10MB",
        },
        { status: 400 },
      );
    }

    const drive = await createGoogleDriveClient();

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: file.name,
      parents: [folderId],
    };

    const media = {
      mimeType: file.type,
      body: stream,
    };

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      supportsAllDrives: true,
      fields: "id,name,webViewLink,thumbnailLink,size,mimeType",
    });

    return NextResponse.json(
      {
        success: true,
        fileId: uploadedFile.data.id,
        fileName: uploadedFile.data.name,
        webViewLink: uploadedFile.data.webViewLink,
        thumbnailLink: uploadedFile.data.thumbnailLink,
        fileSize: uploadedFile.data.size,
        mimeType: uploadedFile.data.mimeType,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Google Drive image upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload image to Google Drive",
      },
      { status: 500 },
    );
  }
}

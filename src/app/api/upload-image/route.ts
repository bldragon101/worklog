import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.upload);

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No image file provided",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const fileExtension = ALLOWED_IMAGE_TYPES[file.type];
    if (!fileExtension) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File size must be less than 5MB",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const originalFileName = file.name.toLowerCase();
    if (
      originalFileName.includes("..") ||
      originalFileName.includes("/") ||
      originalFileName.includes("\\")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file name",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isImage = validateImageBuffer({ buffer });
    if (!isImage) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid image file",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).slice(2, 15);
    const blobPath = `uploads/image_${timestamp}_${randomString}${fileExtension}`;

    const blob = await put(blobPath, file, {
      access: "public",
      token: process.env.WORKLOG_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      contentType: file.type,
    });

    return NextResponse.json(
      {
        success: true,
        imageUrl: blob.url,
        fileName: blob.pathname,
        fileSize: file.size,
        fileType: file.type,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

function validateImageBuffer({ buffer }: { buffer: Buffer }): boolean {
  if (buffer.length < 12) {
    return false;
  }

  const jpegSignature = [0xff, 0xd8, 0xff];
  const pngSignature = [0x89, 0x50, 0x4e, 0x47];
  const gifSignature = [0x47, 0x49, 0x46];
  const riffSignature = [0x52, 0x49, 0x46, 0x46];
  const webpSignature = [0x57, 0x45, 0x42, 0x50];

  if (hasSignature({ buffer, signature: jpegSignature })) return true;
  if (hasSignature({ buffer, signature: pngSignature })) return true;
  if (hasSignature({ buffer, signature: gifSignature })) return true;

  if (hasSignature({ buffer, signature: riffSignature })) {
    const isWebp = webpSignature.every(
      (byte, index) => buffer[8 + index] === byte,
    );
    if (isWebp) return true;
  }

  return false;
}

function hasSignature({
  buffer,
  signature,
}: {
  buffer: Buffer;
  signature: number[];
}): boolean {
  for (const [index, byte] of signature.entries()) {
    if (buffer[index] !== byte) {
      return false;
    }
  }

  return true;
}

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const rateLimit = createRateLimiter(rateLimitConfigs.upload);

// Allowed file types and their MIME types
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No image file provided'
      }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES[file.type as keyof typeof ALLOWED_IMAGE_TYPES]) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'File size must be less than 5MB'
      }, { status: 400 });
    }

    // Validate file name
    const fileName = file.name.toLowerCase();
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file name'
      }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate secure unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = ALLOWED_IMAGE_TYPES[file.type as keyof typeof ALLOWED_IMAGE_TYPES];
    const secureFileName = `image_${timestamp}_${randomString}${fileExtension}`;
    const filePath = path.join(uploadsDir, secureFileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Additional security: Check if the file is actually an image by reading its header
    const isImage = await validateImageBuffer(buffer);
    if (!isImage) {
      return NextResponse.json({
        success: false,
        error: 'Invalid image file'
      }, { status: 400 });
    }

    await writeFile(filePath, buffer);

    // Return the public URL
    const imageUrl = `/uploads/${secureFileName}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName: secureFileName,
      fileSize: file.size,
      fileType: file.type
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Validate that the buffer contains a valid image
async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  // Check for common image file signatures
  const signatures = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46],
  };

  for (const [format, signature] of Object.entries(signatures)) {
    let isValid = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        isValid = false;
        break;
      }
    }
    if (isValid) return true;
  }

  return false;
} 
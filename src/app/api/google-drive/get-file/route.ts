import { NextRequest, NextResponse } from 'next/server';
import { createGoogleDriveClient } from '@/lib/google-auth';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
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

    const targetUser = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 500 });
    }
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'fileId is required'
      }, { status: 400 });
    }

    // Get the authenticated client using the secure method
    const drive = await createGoogleDriveClient(targetUser);

    // Get the file metadata first
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size',
      supportsAllDrives: true,
    });

    const mimeType = fileMetadata.data.mimeType;
    
    // Check if it's a supported file type (image or PDF)
    if (!mimeType?.startsWith('image/') && mimeType !== 'application/pdf') {
      return NextResponse.json({
        success: false,
        error: 'File type not supported. Only images and PDFs are allowed.'
      }, { status: 400 });
    }

    // Get the file content
    const fileResponse = await drive.files.get({
      fileId: fileId,
      alt: 'media',
      supportsAllDrives: true,
    }, {
      responseType: 'arraybuffer'
    });

    // Convert to base64
    const buffer = Buffer.from(fileResponse.data as ArrayBuffer);
    const base64 = buffer.toString('base64');
    const fileUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      fileUrl,
      imageUrl: fileUrl, // Keep for backward compatibility
      fileName: fileMetadata.data.name,
      fileSize: fileMetadata.data.size,
      mimeType: fileMetadata.data.mimeType,
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Google Drive get file error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get file from Google Drive'
    }, { status: 500 });
  }
}
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

    // Get only the file metadata (name, size, mimeType) without downloading content
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size,createdTime',
      supportsAllDrives: true,
    });

    return NextResponse.json({
      success: true,
      fileName: fileMetadata.data.name,
      fileSize: fileMetadata.data.size,
      mimeType: fileMetadata.data.mimeType,
      fileId: fileMetadata.data.id,
      createdTime: fileMetadata.data.createdTime,
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Google Drive get metadata error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get file metadata from Google Drive'
    }, { status: 500 });
  }
}
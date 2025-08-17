import { NextRequest, NextResponse } from 'next/server';
import { createGoogleDriveClient } from '@/lib/google-auth';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

interface BatchMetadataRequest {
  fileIds: string[];
}

interface FileMetadataResult {
  fileId: string;
  fileName: string | null;
  fileSize: string | null;
  mimeType: string | null;
  createdTime: string | null;
  error?: string;
}

export async function POST(request: NextRequest) {
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

    let body: BatchMetadataRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }

    const { fileIds } = body;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'fileIds array is required and must not be empty'
      }, { status: 400 });
    }

    if (fileIds.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Maximum 50 file IDs allowed per batch request'
      }, { status: 400 });
    }

    // Validate all file IDs are strings
    if (!fileIds.every(id => typeof id === 'string' && id.trim().length > 0)) {
      return NextResponse.json({
        success: false,
        error: 'All file IDs must be non-empty strings'
      }, { status: 400 });
    }

    const drive = await createGoogleDriveClient(targetUser);
    const results: FileMetadataResult[] = [];

    // Process files in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < fileIds.length; i += batchSize) {
      const batch = fileIds.slice(i, i + batchSize);
      
      // Process each file in the current batch
      const batchPromises = batch.map(async (fileId): Promise<FileMetadataResult> => {
        try {
          const fileMetadata = await drive.files.get({
            fileId: fileId.trim(),
            fields: 'id,name,mimeType,size,createdTime',
            supportsAllDrives: true,
          });

          return {
            fileId,
            fileName: fileMetadata.data.name || null,
            fileSize: fileMetadata.data.size || null,
            mimeType: fileMetadata.data.mimeType || null,
            createdTime: fileMetadata.data.createdTime || null,
          };
        } catch (error) {
          console.error(`Failed to get metadata for file ${fileId}:`, error);
          return {
            fileId,
            fileName: null,
            fileSize: null,
            mimeType: null,
            createdTime: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      // Wait for the current batch to complete before proceeding
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Separate successful results from errors
    const successful = results.filter(result => !result.error);
    const failed = results.filter(result => result.error);

    return NextResponse.json({
      success: true,
      results: successful,
      errors: failed.length > 0 ? failed : undefined,
      totalRequested: fileIds.length,
      totalSuccessful: successful.length,
      totalFailed: failed.length,
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Batch metadata API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch batch metadata from Google Drive'
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';

const credentialFilename = path.join(process.cwd(), "worklog-467202-81b65697f684.json");
const scopes = ["https://www.googleapis.com/auth/drive"];

// Create auth with service account
const auth = new google.auth.GoogleAuth({
  keyFile: credentialFilename, 
  scopes: scopes
});

export async function GET(request: NextRequest) {
  const targetUser = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!targetUser) {
    return NextResponse.json({
      success: false,
      error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is required'
    }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({
        success: false,
        error: 'fileId is required'
      }, { status: 400 });
    }

    // Get the authenticated client
    const authClient = await auth.getClient();
    
    // Set the target user for impersonation (cast to any to bypass type checking)
    (authClient as any).subject = targetUser;
    
    const drive = google.drive({ version: "v3", auth: authClient as any });

    // Get the file metadata first
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,size',
      supportsAllDrives: true,
    });

    // Check if it's an image
    if (!fileMetadata.data.mimeType?.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: 'File is not an image'
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
    const mimeType = fileMetadata.data.mimeType || 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName: fileMetadata.data.name,
      fileSize: fileMetadata.data.size,
      mimeType: fileMetadata.data.mimeType,
    });

  } catch (error) {
    console.error('Google Drive get image error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get image from Google Drive'
    }, { status: 500 });
  }
} 
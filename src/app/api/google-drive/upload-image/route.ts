import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { createGoogleDriveClient } from '@/lib/google-auth';

export async function POST(request: NextRequest) {
  const targetUser = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!targetUser) {
    return NextResponse.json({
      success: false,
      error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is required'
    }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const driveId = formData.get('driveId') as string;
    const folderId = formData.get('folderId') as string;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No image file provided'
      }, { status: 400 });
    }

    if (!driveId || !folderId) {
      return NextResponse.json({
        success: false,
        error: 'driveId and folderId are required'
      }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: 'File must be an image'
      }, { status: 400 });
    }

    // Validate file size (max 10MB for Google Drive)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size must be less than 10MB'
      }, { status: 400 });
    }

    // Get the authenticated client using the secure method
    const drive = await createGoogleDriveClient(targetUser);

    // Convert file to buffer and create readable stream
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null); // End the stream

    // Prepare file metadata
    const fileMetadata = {
      name: file.name,
      parents: [folderId],
    };

    // Prepare media with stream
    const media = {
      mimeType: file.type,
      body: stream,
    };

    // Upload to Google Drive
    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      supportsAllDrives: true,
      fields: 'id,name,webViewLink,thumbnailLink,size,mimeType',
    });

    return NextResponse.json({
      success: true,
      fileId: uploadedFile.data.id,
      fileName: uploadedFile.data.name,
      webViewLink: uploadedFile.data.webViewLink,
      thumbnailLink: uploadedFile.data.thumbnailLink,
      fileSize: uploadedFile.data.size,
      mimeType: uploadedFile.data.mimeType,
    });

  } catch (error) {
    console.error('Google Drive image upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image to Google Drive'
    }, { status: 500 });
  }
} 
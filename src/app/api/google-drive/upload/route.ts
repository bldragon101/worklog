import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, fileName, fileContent, folderId } = await request.json();

    if (!accessToken || !fileName || !fileContent) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Validate folder access if folderId is provided
    if (folderId) {
      try {
        await drive.files.get({
          fileId: folderId,
          fields: 'id,name,capabilities,driveId',
          supportsAllDrives: true,
        });
      } catch (error) {
        console.error('Folder validation failed:', error);
        return NextResponse.json({ 
          error: 'Selected folder not found or you do not have access to it. Please select a different folder.' 
        }, { status: 400 });
      }
    }

    // Upload file using the simpler approach
    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType: 'text/csv',
        body: fileContent,
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    });

    return NextResponse.json({
      success: true,
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
    });

  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return NextResponse.json({ error: 'Failed to upload to Google Drive' }, { status: 500 });
  }
} 
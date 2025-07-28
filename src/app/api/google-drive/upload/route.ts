import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, fileName, fileContent, folderId } = await request.json();

    if (!accessToken || !fileName || !fileContent) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Check if environment variables are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google Drive environment variables not configured');
      return NextResponse.json({ 
        error: 'Google Drive integration not configured. Please check environment variables.' 
      }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
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
    
    // Check for specific error types
    const errorObj = error as { code?: number; message?: string };
    if (errorObj.code === 401) {
      return NextResponse.json({ 
        error: 'Authentication failed. Please re-authenticate with Google Drive.',
        code: 'AUTH_ERROR'
      }, { status: 401 });
    } else if (errorObj.code === 403) {
      return NextResponse.json({ 
        error: 'Access denied. You may not have permission to upload to this folder.',
        code: 'PERMISSION_ERROR'
      }, { status: 403 });
    } else if (errorObj.code === 404) {
      return NextResponse.json({ 
        error: 'Folder not found. Please select a different folder.',
        code: 'FOLDER_NOT_FOUND'
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to upload to Google Drive. Please try again.',
      details: errorObj.message
    }, { status: 500 });
  }
} 
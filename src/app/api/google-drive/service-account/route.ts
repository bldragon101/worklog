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
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const targetUser = searchParams.get('user') || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is required'
      }, { status: 400 });
    }

    // Get the authenticated client
    const authClient = await auth.getClient();
    
    // Set the target user for impersonation (cast to any to bypass type checking)
    (authClient as any).subject = targetUser;
    
    const drive = google.drive({ version: "v3", auth: authClient as any });

    switch (action) {
      case 'list-shared-drives':
        // List all shared drives
        const sharedDrivesResponse = await drive.drives.list({
          pageSize: 10,
          fields: "nextPageToken, drives(id, name)",
        });

        const sharedDrives = sharedDrivesResponse.data.drives || [];
        
        return NextResponse.json({
          success: true,
          sharedDrives: sharedDrives.map((drive: any) => ({
            id: drive.id,
            name: drive.name
          }))
        });

      case 'list-drive-folders':
        const driveId = searchParams.get('driveId');
        
        if (!driveId) {
          return NextResponse.json({
            success: false,
            error: 'driveId is required'
          }, { status: 400 });
        }

        // List all folders in the shared drive (excluding deleted ones)
        const foldersResponse = await drive.files.list({
          corpora: 'drive',
          driveId: driveId,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id, name, mimeType, createdTime)",
          pageSize: 100,
        });

        const folders = foldersResponse.data.files || [];
        
        return NextResponse.json({
          success: true,
          folders: folders.map((folder: any) => ({
            id: folder.id,
            name: folder.name,
            mimeType: folder.mimeType,
            createdTime: folder.createdTime,
            isFolder: true
          }))
        });

      case 'list-folder-contents':
        const folderDriveId = searchParams.get('driveId');
        const folderId = searchParams.get('folderId');
        
        if (!folderDriveId || !folderId) {
          return NextResponse.json({
            success: false,
            error: 'driveId and folderId are required'
          }, { status: 400 });
        }

        // List contents of specific folder in shared drive (excluding deleted files)
        const filesResponse = await drive.files.list({
          corpora: 'drive',
          driveId: folderDriveId,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          q: `'${folderId}' in parents and trashed=false`,
          fields: "files(id, name, mimeType, createdTime, modifiedTime)",
          pageSize: 100,
          orderBy: "modifiedTime desc"
        });

        const files = filesResponse.data.files || [];
        
        return NextResponse.json({
          success: true,
          files: files.map((file: any) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
            isFolder: file.mimeType === 'application/vnd.google-apps.folder'
          }))
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Service account Google Drive error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const targetUser = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!targetUser) {
    return NextResponse.json({
      success: false,
      error: 'GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is required'
    }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { fileName, fileContent, driveId, folderId, isImageUpload } = body;

    if (!fileName || !driveId || !folderId) {
      return NextResponse.json({
        success: false,
        error: 'fileName, driveId, and folderId are required'
      }, { status: 400 });
    }

    const authClient = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    (authClient as any).subject = targetUser;
    const drive = google.drive({ version: 'v3', auth: authClient as any });

    if (isImageUpload) {
      // Handle image upload - we need to get the file from the request
      // For now, we'll create a simple text file as placeholder
      // In a real implementation, you'd need to handle multipart form data
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: 'text/plain',
        body: 'Image upload placeholder - implement proper file handling',
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        supportsAllDrives: true,
        fields: 'id,name,webViewLink,thumbnailLink',
      });

      return NextResponse.json({
        success: true,
        fileId: file.data.id,
        fileName: file.data.name,
        webViewLink: file.data.webViewLink,
        thumbnailLink: file.data.thumbnailLink,
      });
    } else {
      // Handle regular text file upload
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: 'text/csv',
        body: fileContent,
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        supportsAllDrives: true,
        fields: 'id,name,webViewLink',
      });

      return NextResponse.json({
        success: true,
        fileId: file.data.id,
        fileName: file.data.name,
        webViewLink: file.data.webViewLink,
      });
    }
  } catch (error) {
    console.error('Service account upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file'
    }, { status: 500 });
  }
} 
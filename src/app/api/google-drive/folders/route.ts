import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

interface GoogleDriveFile {
  id?: string | null;
  name?: string | null;
  parents?: string[] | null;
  capabilities?: {
    canAddChildren?: boolean;
    canDelete?: boolean;
    canEdit?: boolean;
  } | null;
  driveId?: string | null;
}

interface GoogleSharedDrive {
  id?: string | null;
  name?: string | null;
  capabilities?: {
    canAddChildren?: boolean;
    canDelete?: boolean;
    canEdit?: boolean;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    let sharedDrives: GoogleSharedDrive[] = [];
    let folders: GoogleDriveFile[] = [];

    try {
      // Get shared drives
      const sharedDrivesResponse = await drive.drives.list({
        pageSize: 100,
        fields: 'drives(id,name,capabilities)',
      });
      sharedDrives = sharedDrivesResponse.data.drives || [];
    } catch (error) {
      console.log('Could not access shared drives, continuing with user folders only', error);
    }

    try {
      // Get user's folders (including shared drive folders)
      const foldersResponse = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        pageSize: 100,
        fields: 'files(id,name,parents,capabilities,driveId)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      folders = foldersResponse.data.files || [];
    } catch (error) {
      console.error('Error fetching user folders:', error);
    }

    return NextResponse.json({
      sharedDrives: sharedDrives,
      folders: folders,
    });

  } catch (error) {
    console.error('Error fetching Google Drive folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
} 
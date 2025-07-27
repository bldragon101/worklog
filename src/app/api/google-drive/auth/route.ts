import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-drive/callback'
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') || 'worklog'; // Default to worklog, can be 'customers'

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent'
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
} 
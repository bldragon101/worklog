import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-drive/callback'
);

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
    }

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Get new access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return NextResponse.json({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || refreshToken, // Keep existing refresh token if new one not provided
      expiry_date: credentials.expiry_date
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
  }
} 
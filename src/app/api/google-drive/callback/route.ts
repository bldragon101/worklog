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
    const code = searchParams.get('code');
    const state = searchParams.get('state') || 'worklog';

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Redirect back to the appropriate page based on state
    let redirectPath = '/';
    if (state === 'customers') {
      redirectPath = '/customers';
    }
    
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set('access_token', tokens.access_token || '');
    redirectUrl.searchParams.set('refresh_token', tokens.refresh_token || '');
    redirectUrl.searchParams.set('state', state);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.json({ error: 'OAuth callback failed' }, { status: 500 });
  }
} 
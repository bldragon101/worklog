import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    return NextResponse.json({
      configured: {
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        redirectUri: !!redirectUri,
      },
      clientId: clientId ? `${clientId.substring(0, 10)}...` : null,
      redirectUri,
    });
  } catch (error) {
    console.error('Error testing Google Drive config:', error);
    return NextResponse.json({ error: 'Failed to test configuration' }, { status: 500 });
  }
} 
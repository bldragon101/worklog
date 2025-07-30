import { google } from 'googleapis';

/**
 * Creates Google Auth client from environment variable
 * This is the secure way to handle service account credentials in production
 */
export function createGoogleAuthClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable is required');
  }

  try {
    // Decode base64 credentials
    const decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
    const serviceAccountKey = JSON.parse(decodedCredentials);

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return auth;
  } catch (error) {
    console.error('Error creating Google Auth client:', error);
    throw new Error('Invalid service account credentials');
  }
}

/**
 * Creates Google Drive client with service account
 */
export async function createGoogleDriveClient(targetUser?: string) {
  const auth = createGoogleAuthClient();
  const authClient = await auth.getClient();
  
  // Set impersonation if target user is provided
  if (targetUser) {
    (authClient as any).subject = targetUser;
  }
  
  return google.drive({ version: 'v3', auth: authClient as any });
}

/**
 * Creates OAuth2 client for user authentication
 */
export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required');
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri || 'http://localhost:3000/api/google-drive/callback'
  );
} 
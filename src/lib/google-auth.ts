import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/google-drive-encryption";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-drive/auth/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens({
  code,
}: {
  code: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiry: Date;
  email: string;
}> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Failed to obtain tokens from Google. Ensure the app has offline access and consent was granted.",
    );
  }

  oauth2Client.setCredentials(tokens);

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const about = await drive.about.get({ fields: "user" });
  const email = about.data.user?.emailAddress || "unknown";

  const expiry = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiry,
    email,
  };
}

export async function storeTokens({
  userId,
  email,
  accessToken,
  refreshToken,
  expiry,
}: {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiry: Date;
}): Promise<void> {
  const encryptedAccess = encryptToken({ token: accessToken });
  const encryptedRefresh = encryptToken({ token: refreshToken });

  await prisma.googleDriveToken.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  await prisma.googleDriveToken.create({
    data: {
      userId,
      email,
      accessTokenEncrypted: encryptedAccess.encrypted,
      accessTokenIv: encryptedAccess.iv,
      accessTokenTag: encryptedAccess.tag,
      refreshTokenEncrypted: encryptedRefresh.encrypted,
      refreshTokenIv: encryptedRefresh.iv,
      refreshTokenTag: encryptedRefresh.tag,
      tokenExpiry: expiry,
      scopes: SCOPES,
      isActive: true,
    },
  });
}

async function getStoredTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiry: Date;
  id: number;
} | null> {
  const tokenRecord = await prisma.googleDriveToken.findFirst({
    where: { isActive: true },
  });

  if (!tokenRecord) {
    return null;
  }

  const accessToken = decryptToken({
    encrypted: tokenRecord.accessTokenEncrypted,
    iv: tokenRecord.accessTokenIv,
    tag: tokenRecord.accessTokenTag,
  });

  const refreshToken = decryptToken({
    encrypted: tokenRecord.refreshTokenEncrypted,
    iv: tokenRecord.refreshTokenIv,
    tag: tokenRecord.refreshTokenTag,
  });

  return {
    accessToken,
    refreshToken,
    expiry: tokenRecord.tokenExpiry,
    id: tokenRecord.id,
  };
}

async function refreshAccessToken({
  refreshToken,
  tokenId,
}: {
  refreshToken: string;
  tokenId: number;
}): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google Drive access token");
  }

  const encryptedAccess = encryptToken({ token: credentials.access_token });
  const newExpiry = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await prisma.googleDriveToken.update({
    where: { id: tokenId },
    data: {
      accessTokenEncrypted: encryptedAccess.encrypted,
      accessTokenIv: encryptedAccess.iv,
      accessTokenTag: encryptedAccess.tag,
      tokenExpiry: newExpiry,
    },
  });

  return credentials.access_token;
}

export async function createGoogleDriveClient() {
  const storedTokens = await getStoredTokens();

  if (!storedTokens) {
    throw new Error(
      "Google Drive is not connected. An administrator must connect Google Drive from the Integrations page.",
    );
  }

  const oauth2Client = getOAuth2Client();

  const isExpired = storedTokens.expiry <= new Date(Date.now() + 60 * 1000);

  let accessToken = storedTokens.accessToken;

  if (isExpired) {
    accessToken = await refreshAccessToken({
      refreshToken: storedTokens.refreshToken,
      tokenId: storedTokens.id,
    });
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: storedTokens.refreshToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  email: string | null;
  expiry: Date | null;
}> {
  const tokenRecord = await prisma.googleDriveToken.findFirst({
    where: { isActive: true },
    select: { email: true, tokenExpiry: true },
  });

  if (!tokenRecord) {
    return { connected: false, email: null, expiry: null };
  }

  return {
    connected: true,
    email: tokenRecord.email,
    expiry: tokenRecord.tokenExpiry,
  };
}

export async function disconnectGoogleDrive(): Promise<void> {
  const storedTokens = await getStoredTokens();

  if (storedTokens) {
    try {
      const oauth2Client = getOAuth2Client();
      await oauth2Client.revokeToken(storedTokens.accessToken);
    } catch {
      try {
        const oauth2Client = getOAuth2Client();
        await oauth2Client.revokeToken(storedTokens.refreshToken);
      } catch (error) {
        console.error(
          "Failed to revoke Google tokens (continuing with disconnect):",
          error,
        );
      }
    }
  }

  await prisma.googleDriveToken.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
}

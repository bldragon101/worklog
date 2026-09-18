import { google, Auth } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/google-drive-encryption";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

/**
 * Raised when the stored Google Drive credentials exist but can no longer be
 * used (refresh rejected by Google, or the ciphertext cannot be decrypted with
 * the current GOOGLE_DRIVE_ENCRYPTION_KEY). The only recovery is for an
 * administrator to reconnect, so callers should surface this as a 401 rather
 * than a generic 500.
 */
export class GoogleDriveReauthRequiredError extends Error {
  readonly code = "REAUTH_REQUIRED";

  constructor(
    message = "Google Drive authorisation is no longer valid. An administrator must reconnect Google Drive from the Integrations page.",
  ) {
    super(message);
    this.name = "GoogleDriveReauthRequiredError";
  }
}

async function deactivateStoredTokens(): Promise<void> {
  await prisma.googleDriveToken.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required",
    );
  }

  if (!appUrl || !appUrl.trim()) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL environment variable is required for Google OAuth redirect",
    );
  }

  const redirectUri = `${appUrl.replace(/\/+$/, "")}/api/google-drive/auth/callback`;

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

  await prisma.$transaction(async (tx) => {
    await tx.googleDriveToken.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    await tx.googleDriveToken.create({
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

  let accessToken: string;
  let refreshToken: string;

  // AES-GCM authentication fails hard when the ciphertext was written with a
  // different GOOGLE_DRIVE_ENCRYPTION_KEY - a common cause when several
  // environments share one database. Surface that as "reconnect required"
  // instead of letting an opaque crypto error bubble up as a 500.
  try {
    accessToken = decryptToken({
      encrypted: tokenRecord.accessTokenEncrypted,
      iv: tokenRecord.accessTokenIv,
      tag: tokenRecord.accessTokenTag,
    });

    refreshToken = decryptToken({
      encrypted: tokenRecord.refreshTokenEncrypted,
      iv: tokenRecord.refreshTokenIv,
      tag: tokenRecord.refreshTokenTag,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(
      `Google Drive: stored tokens could not be decrypted (${detail}). ` +
        "GOOGLE_DRIVE_ENCRYPTION_KEY most likely does not match the key used when the tokens were stored.",
    );
    // Deliberately not deactivating here: the token may well be valid for
    // another environment that holds the correct key, and several environments
    // share one database. Only this environment cannot read it.
    throw new GoogleDriveReauthRequiredError(
      "Stored Google Drive credentials could not be decrypted in this environment. Check GOOGLE_DRIVE_ENCRYPTION_KEY, or reconnect Google Drive.",
    );
  }

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
  currentExpiry,
}: {
  refreshToken: string;
  tokenId: number;
  currentExpiry: Date;
}): Promise<string> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  let credentials: Auth.Credentials;

  // Google rejects the refresh token once it has been revoked, or after 7 days
  // when the OAuth app is still in "Testing" publishing status. Either way the
  // connection is dead until an administrator reconnects, so record that rather
  // than reporting a generic failure on every subsequent request.
  try {
    ({ credentials } = await oauth2Client.refreshAccessToken());
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(
      `Google Drive: refreshing the access token failed (${detail}). ` +
        "The stored refresh token has been marked inactive; Google Drive must be reconnected.",
    );
    await deactivateStoredTokens();
    throw new GoogleDriveReauthRequiredError();
  }

  if (!credentials.access_token) {
    throw new GoogleDriveReauthRequiredError(
      "Google did not return a new access token. Reconnect Google Drive to continue.",
    );
  }

  const encryptedAccess = encryptToken({ token: credentials.access_token });
  const newExpiry = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  const updateData: Record<string, string | Date> = {
    accessTokenEncrypted: encryptedAccess.encrypted,
    accessTokenIv: encryptedAccess.iv,
    accessTokenTag: encryptedAccess.tag,
    tokenExpiry: newExpiry,
  };

  if (credentials.refresh_token) {
    const encryptedRefresh = encryptToken({ token: credentials.refresh_token });
    updateData.refreshTokenEncrypted = encryptedRefresh.encrypted;
    updateData.refreshTokenIv = encryptedRefresh.iv;
    updateData.refreshTokenTag = encryptedRefresh.tag;
  }

  const { count } = await prisma.googleDriveToken.updateMany({
    where: { id: tokenId, tokenExpiry: currentExpiry },
    data: updateData,
  });

  if (count === 0) {
    const freshTokens = await getStoredTokens();
    if (!freshTokens) {
      throw new Error("Google Drive token record was removed during refresh");
    }
    return freshTokens.accessToken;
  }

  return credentials.access_token;
}

export async function createGoogleDriveClient() {
  const storedTokens = await getStoredTokens();

  if (!storedTokens) {
    throw new GoogleDriveReauthRequiredError(
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
      currentExpiry: storedTokens.expiry,
    });
  }

  const finalRefreshToken = isExpired
    ? ((await getStoredTokens())?.refreshToken ?? storedTokens.refreshToken)
    : storedTokens.refreshToken;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: finalRefreshToken,
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
  try {
    const storedTokens = await getStoredTokens();

    if (storedTokens) {
      try {
        const oauth2Client = getOAuth2Client();
        await oauth2Client.revokeToken(storedTokens.accessToken);
      } catch {
        try {
          const oauth2Client = getOAuth2Client();
          await oauth2Client.revokeToken(storedTokens.refreshToken);
        } catch {
          console.error(
            "Failed to revoke Google tokens (continuing with disconnect).",
          );
        }
      }
    }
  } catch {
    console.error(
      "Failed to retrieve stored tokens for revocation (continuing with disconnect).",
    );
  }

  await prisma.googleDriveToken.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
}

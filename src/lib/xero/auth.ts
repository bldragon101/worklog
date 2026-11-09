import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { decryptTokenWithKey, encryptTokenWithKey } from "@/lib/token-encryption";
import {
  getMissingXeroEnvVars,
  getXeroAppConfig,
  XERO_AUTHORISE_URL,
  XERO_CONNECTIONS_URL,
  XERO_ENCRYPTION_KEY_ENV_VAR,
  XERO_REVOKE_URL,
  XERO_TOKEN_URL,
} from "@/lib/xero/config";
import type { XeroConnectionStatus } from "@/lib/xero/types";

/** Refresh the access token when it has less than this left */
const EXPIRY_MARGIN_MS = 60 * 1000;
/** How long a refresh may hold the connection row lock */
const REFRESH_TRANSACTION_TIMEOUT_MS = 20 * 1000;

/**
 * Raised when Xero is not connected, or the stored connection can no longer
 * be used (refresh token rejected or expired, or the tokens cannot be
 * decrypted with this environment's XERO_ENCRYPTION_KEY). An administrator
 * must reconnect from the Integrations page.
 */
export class XeroReauthRequiredError extends ApiError {
  readonly code = "XERO_REAUTH_REQUIRED";

  constructor(
    message = "Xero authorisation is no longer valid. An administrator must reconnect Xero from the Integrations page.",
  ) {
    super({ status: 401, message, body: { success: false, code: "XERO_REAUTH_REQUIRED" } });
    this.name = "XeroReauthRequiredError";
  }
}

export interface XeroTokenSet {
  accessToken: string;
  refreshToken: string;
  expiry: Date;
  scopes: string[];
}

export interface XeroTenantConnection {
  id: string;
  authEventId: string | null;
  tenantId: string;
  tenantType: string;
  tenantName: string;
}

interface XeroTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getXeroAppConfig();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

/** The URL that starts the Xero sign-in, with `state` checked on the way back */
export function buildXeroAuthorisationUrl({ state }: { state: string }): string {
  const { clientId, redirectUri, scopes } = getXeroAppConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
  });
  return `${XERO_AUTHORISE_URL}?${params.toString()}`;
}

async function requestTokens({ body }: { body: URLSearchParams }): Promise<XeroTokenSet> {
  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const data = (await response.json().catch(() => ({}))) as XeroTokenResponse;

  if (!response.ok) {
    if (data.error === "invalid_grant") {
      throw new XeroReauthRequiredError();
    }
    throw new Error(`Xero token request failed with ${response.status}${data.error ? ` (${data.error})` : ""}`);
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Xero did not return an access and refresh token. Check the offline_access scope.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiry: new Date(Date.now() + (data.expires_in ?? 1800) * 1000),
    scopes: data.scope?.split(" ").filter(Boolean) ?? [],
  };
}

export function exchangeXeroCode({ code }: { code: string }): Promise<XeroTokenSet> {
  const { redirectUri } = getXeroAppConfig();
  return requestTokens({
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
}

/** The organisations the access token can reach */
export async function fetchXeroTenantConnections({
  accessToken,
}: {
  accessToken: string;
}): Promise<XeroTenantConnection[]> {
  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to list Xero organisations (${response.status})`);
  }
  const connections = (await response.json()) as XeroTenantConnection[];
  return Array.isArray(connections) ? connections : [];
}

/** The `authentication_event_id` claim of a Xero access token, if readable */
export function getAuthEventId({ accessToken }: { accessToken: string }): string | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      authentication_event_id?: unknown;
    };
    return typeof claims.authentication_event_id === "string"
      ? claims.authentication_event_id
      : null;
  } catch {
    return null;
  }
}

/**
 * The organisation chosen in this sign-in: the one connected by the token's
 * authentication event, otherwise the first organisation.
 */
export function chooseXeroTenant({
  connections,
  accessToken,
}: {
  connections: XeroTenantConnection[];
  accessToken: string;
}): XeroTenantConnection | null {
  const organisations = connections.filter(
    (connection) => connection.tenantType === "ORGANISATION",
  );
  const authEventId = getAuthEventId({ accessToken });
  const fromThisSignIn = authEventId
    ? organisations.find((connection) => connection.authEventId === authEventId)
    : undefined;
  return fromThisSignIn ?? organisations[0] ?? null;
}

function encrypt({ token }: { token: string }) {
  return encryptTokenWithKey({ token, keyEnvVar: XERO_ENCRYPTION_KEY_ENV_VAR });
}

function encryptedTokenFields({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}) {
  const access = encrypt({ token: accessToken });
  const refresh = encrypt({ token: refreshToken });
  return {
    accessTokenEncrypted: access.encrypted,
    accessTokenIv: access.iv,
    accessTokenTag: access.tag,
    refreshTokenEncrypted: refresh.encrypted,
    refreshTokenIv: refresh.iv,
    refreshTokenTag: refresh.tag,
  };
}

/**
 * Exchanges the sign-in code, picks the organisation and stores it as the
 * only active connection.
 */
export async function completeXeroAuthorisation({
  code,
  userId,
}: {
  code: string;
  userId: string;
}): Promise<{ tenantName: string }> {
  const tokens = await exchangeXeroCode({ code });
  const connections = await fetchXeroTenantConnections({ accessToken: tokens.accessToken });
  const tenant = chooseXeroTenant({ connections, accessToken: tokens.accessToken });

  if (!tenant) {
    throw new ApiError({
      status: 400,
      message: "No Xero organisation was connected. Choose an organisation when signing in.",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.xeroConnection.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.xeroConnection.create({
      data: {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        connectionId: tenant.id,
        userId,
        ...encryptedTokenFields(tokens),
        tokenExpiry: tokens.expiry,
        scopes: tokens.scopes,
        isActive: true,
      },
    });
  });

  return { tenantName: tenant.tenantName };
}

interface ConnectionRow {
  id: number;
  tenantId: string;
  connectionId: string | null;
  accessTokenEncrypted: string;
  accessTokenIv: string;
  accessTokenTag: string;
  refreshTokenEncrypted: string;
  refreshTokenIv: string;
  refreshTokenTag: string;
  tokenExpiry: Date;
}

function decryptRow({ row }: { row: ConnectionRow }): { accessToken: string; refreshToken: string } {
  try {
    return {
      accessToken: decryptTokenWithKey({
        encrypted: row.accessTokenEncrypted,
        iv: row.accessTokenIv,
        tag: row.accessTokenTag,
        keyEnvVar: XERO_ENCRYPTION_KEY_ENV_VAR,
      }),
      refreshToken: decryptTokenWithKey({
        encrypted: row.refreshTokenEncrypted,
        iv: row.refreshTokenIv,
        tag: row.refreshTokenTag,
        keyEnvVar: XERO_ENCRYPTION_KEY_ENV_VAR,
      }),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(
      `Xero: stored tokens could not be decrypted (${detail}). XERO_ENCRYPTION_KEY most likely differs from the key used to store them.`,
    );
    throw new XeroReauthRequiredError(
      "Stored Xero credentials could not be decrypted in this environment. Check XERO_ENCRYPTION_KEY, or reconnect Xero.",
    );
  }
}

export interface XeroAccessToken {
  accessToken: string;
  tenantId: string;
  tokenExpiry: Date;
}

/**
 * A usable access token for the active connection, refreshing it when it is
 * about to expire. Xero refresh tokens change on every use, so the refresh
 * runs under a row lock: a second request waits and then uses the token the
 * first one saved. Pass `staleExpiry` to force a refresh after Xero rejected
 * the token with that expiry.
 */
export async function getXeroAccessToken({
  staleExpiry,
}: {
  staleExpiry?: Date;
} = {}): Promise<XeroAccessToken> {
  const active = await prisma.xeroConnection.findFirst({ where: { isActive: true } });
  if (!active) {
    throw new XeroReauthRequiredError(
      "Xero is not connected. An administrator must connect Xero from the Integrations page.",
    );
  }

  const needsRefresh = ({ row }: { row: ConnectionRow }) =>
    staleExpiry
      ? row.tokenExpiry.getTime() === staleExpiry.getTime()
      : row.tokenExpiry.getTime() <= Date.now() + EXPIRY_MARGIN_MS;

  if (!needsRefresh({ row: active })) {
    return {
      accessToken: decryptRow({ row: active }).accessToken,
      tenantId: active.tenantId,
      tokenExpiry: active.tokenExpiry,
    };
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<ConnectionRow[]>`
        SELECT "id", "tenantId", "connectionId", "accessTokenEncrypted", "accessTokenIv",
               "accessTokenTag", "refreshTokenEncrypted", "refreshTokenIv", "refreshTokenTag",
               "tokenExpiry"
        FROM "XeroConnection"
        WHERE "id" = ${active.id} AND "isActive" = true
        FOR UPDATE`;
      const row = locked[0];
      if (!row) return { kind: "disconnected" as const };

      const { accessToken, refreshToken } = decryptRow({ row });
      if (!needsRefresh({ row })) {
        return {
          kind: "token" as const,
          token: { accessToken, tenantId: row.tenantId, tokenExpiry: row.tokenExpiry },
        };
      }

      let tokens: XeroTokenSet;
      try {
        tokens = await requestTokens({
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
        });
      } catch (error) {
        if (error instanceof XeroReauthRequiredError) return { kind: "rejected" as const };
        throw error;
      }

      await tx.xeroConnection.update({
        where: { id: row.id },
        data: {
          ...encryptedTokenFields(tokens),
          tokenExpiry: tokens.expiry,
          ...(tokens.scopes.length > 0 ? { scopes: tokens.scopes } : {}),
        },
      });
      return {
        kind: "token" as const,
        token: { accessToken: tokens.accessToken, tenantId: row.tenantId, tokenExpiry: tokens.expiry },
      };
    },
    { timeout: REFRESH_TRANSACTION_TIMEOUT_MS },
  );

  if (result.kind === "token") return result.token;

  if (result.kind === "rejected") {
    console.error("Xero: the refresh token was rejected. The connection has been marked inactive.");
    await prisma.xeroConnection.updateMany({
      where: { id: active.id },
      data: { isActive: false },
    });
  }
  throw new XeroReauthRequiredError();
}

export async function getXeroConnectionStatus(): Promise<XeroConnectionStatus> {
  const missingEnvVars = getMissingXeroEnvVars();
  const active = await prisma.xeroConnection.findFirst({
    where: { isActive: true },
    select: {
      tenantName: true,
      createdAt: true,
      scopes: true,
      itemsSyncedAt: true,
      contactsSyncedAt: true,
    },
  });

  return {
    configured: missingEnvVars.length === 0,
    missingEnvVars,
    connected: active !== null,
    tenantName: active?.tenantName ?? null,
    connectedAt: active?.createdAt.toISOString() ?? null,
    scopes: active?.scopes ?? [],
    itemsSyncedAt: active?.itemsSyncedAt?.toISOString() ?? null,
    contactsSyncedAt: active?.contactsSyncedAt?.toISOString() ?? null,
  };
}

/**
 * Removes the app's connection to the organisation in Xero and revokes the
 * refresh token, then marks the stored connection inactive. Failures talking
 * to Xero are logged and do not stop the local disconnect. Synced items,
 * contacts and mappings are kept for a reconnect.
 */
export async function disconnectXero(): Promise<void> {
  const active = await prisma.xeroConnection.findFirst({ where: { isActive: true } });

  if (active) {
    try {
      const { accessToken, refreshToken } = decryptRow({ row: active });
      if (active.connectionId) {
        await fetch(`${XERO_CONNECTIONS_URL}/${encodeURIComponent(active.connectionId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      await fetch(XERO_REVOKE_URL, {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: refreshToken }).toString(),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      console.error(`Xero: failed to revoke the connection (${detail}); continuing with disconnect.`);
    }
  }

  await prisma.xeroConnection.updateMany({ where: { isActive: true }, data: { isActive: false } });
}

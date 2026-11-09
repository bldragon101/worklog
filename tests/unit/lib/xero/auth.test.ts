/**
 * @vitest-environment node
 */
import { randomBytes } from "crypto";
import { ApiError } from "@/lib/api-error";
import { decryptTokenWithKey, encryptTokenWithKey } from "@/lib/token-encryption";
import {
  buildXeroAuthorisationUrl,
  chooseXeroTenant,
  completeXeroAuthorisation,
  disconnectXero,
  getAuthEventId,
  getXeroAccessToken,
  getXeroConnectionStatus,
  XeroReauthRequiredError,
  type XeroTenantConnection,
} from "@/lib/xero/auth";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    xeroConnection: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      update: mocks.update,
      create: mocks.create,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  };
  mocks.transaction.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation(client),
  );
  return { prisma: client };
});

const KEY_ENV = "XERO_ENCRYPTION_KEY";

function jwt({ claims }: { claims: Record<string, unknown> }): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

function decrypt({
  data,
  prefix,
}: {
  data: Record<string, string>;
  prefix: "accessToken" | "refreshToken";
}): string {
  return decryptTokenWithKey({
    encrypted: data[`${prefix}Encrypted`],
    iv: data[`${prefix}Iv`],
    tag: data[`${prefix}Tag`],
    keyEnvVar: KEY_ENV,
  });
}

function connectionRow({
  id = 1,
  accessToken = "access-old",
  refreshToken = "refresh-old",
  tokenExpiry = new Date(Date.now() + 30 * 60 * 1000),
  connectionId = "conn-1" as string | null,
}: {
  id?: number;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  connectionId?: string | null;
} = {}) {
  const access = encryptTokenWithKey({ token: accessToken, keyEnvVar: KEY_ENV });
  const refresh = encryptTokenWithKey({ token: refreshToken, keyEnvVar: KEY_ENV });
  return {
    id,
    tenantId: "tenant-1",
    tenantName: "Acme Transport",
    connectionId,
    accessTokenEncrypted: access.encrypted,
    accessTokenIv: access.iv,
    accessTokenTag: access.tag,
    refreshTokenEncrypted: refresh.encrypted,
    refreshTokenIv: refresh.iv,
    refreshTokenTag: refresh.tag,
    tokenExpiry,
    isActive: true,
  };
}

function jsonResponse({ body, status = 200 }: { body: unknown; status?: number }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchCall({ index }: { index: number }) {
  const [url, init] = mocks.fetch.mock.calls[index] as [string, RequestInit];
  return {
    url,
    init,
    headers: (init.headers ?? {}) as Record<string, string>,
    body: new URLSearchParams(String(init.body ?? "")),
  };
}

const organisation = ({
  tenantId,
  authEventId,
  tenantType = "ORGANISATION",
}: {
  tenantId: string;
  authEventId: string | null;
  tenantType?: string;
}): XeroTenantConnection => ({
  id: `conn-${tenantId}`,
  authEventId,
  tenantId,
  tenantType,
  tenantName: `Org ${tenantId}`,
});

describe("Xero auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("XERO_CLIENT_ID", "client-id");
    vi.stubEnv("XERO_CLIENT_SECRET", "client-secret");
    vi.stubEnv(KEY_ENV, randomBytes(32).toString("base64"));
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com/");
    vi.stubEnv("XERO_SCOPES", "");
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("buildXeroAuthorisationUrl", () => {
    it("asks for a code with the configured client, redirect, scopes and state", () => {
      const url = new URL(buildXeroAuthorisationUrl({ state: "abc" }));

      expect(`${url.origin}${url.pathname}`).toBe(
        "https://login.xero.com/identity/connect/authorize",
      );
      expect(Object.fromEntries(url.searchParams)).toEqual({
        response_type: "code",
        client_id: "client-id",
        redirect_uri: "https://app.example.com/api/xero/auth/callback",
        scope:
          "offline_access accounting.settings.read accounting.contacts.read accounting.invoices accounting.attachments",
        state: "abc",
      });
    });

    it("uses XERO_SCOPES when set", () => {
      vi.stubEnv("XERO_SCOPES", "offline_access, accounting.transactions");

      const url = new URL(buildXeroAuthorisationUrl({ state: "abc" }));

      expect(url.searchParams.get("scope")).toBe("offline_access accounting.transactions");
    });

    it("throws when Xero is not configured", () => {
      vi.stubEnv("XERO_CLIENT_SECRET", "");

      expect(() => buildXeroAuthorisationUrl({ state: "abc" })).toThrow(/XERO_CLIENT_SECRET/);
    });
  });

  describe("getAuthEventId", () => {
    it("reads the authentication_event_id claim", () => {
      expect(
        getAuthEventId({ accessToken: jwt({ claims: { authentication_event_id: "evt-1" } }) }),
      ).toBe("evt-1");
    });

    it.each([
      { name: "a token without the claim", accessToken: jwt({ claims: { sub: "x" } }) },
      { name: "a non-string claim", accessToken: jwt({ claims: { authentication_event_id: 5 } }) },
      { name: "a token that is not a JWT", accessToken: "opaque" },
      { name: "a payload that is not JSON", accessToken: "a.bm90IGpzb24.c" },
    ])("returns null for $name", ({ accessToken }) => {
      expect(getAuthEventId({ accessToken })).toBeNull();
    });
  });

  describe("chooseXeroTenant", () => {
    const accessToken = jwt({ claims: { authentication_event_id: "evt-2" } });

    it("picks the organisation connected in this sign-in", () => {
      const tenant = chooseXeroTenant({
        connections: [
          organisation({ tenantId: "a", authEventId: "evt-1" }),
          organisation({ tenantId: "b", authEventId: "evt-2" }),
        ],
        accessToken,
      });

      expect(tenant?.tenantId).toBe("b");
    });

    it("falls back to the first organisation, skipping practices", () => {
      const tenant = chooseXeroTenant({
        connections: [
          organisation({ tenantId: "p", authEventId: "evt-2", tenantType: "PRACTICE" }),
          organisation({ tenantId: "a", authEventId: "evt-1" }),
          organisation({ tenantId: "c", authEventId: null }),
        ],
        accessToken,
      });

      expect(tenant?.tenantId).toBe("a");
    });

    it("returns null when there is no organisation", () => {
      expect(chooseXeroTenant({ connections: [], accessToken })).toBeNull();
    });
  });

  describe("completeXeroAuthorisation", () => {
    const accessToken = jwt({ claims: { authentication_event_id: "evt-2" } });

    it("stores the organisation as the only active connection with encrypted tokens", async () => {
      mocks.fetch
        .mockResolvedValueOnce(
          jsonResponse({
            body: {
              access_token: accessToken,
              refresh_token: "refresh-new",
              expires_in: 1800,
              scope: "offline_access accounting.invoices",
            },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            body: [
              organisation({ tenantId: "a", authEventId: "evt-1" }),
              organisation({ tenantId: "b", authEventId: "evt-2" }),
            ],
          }),
        );
      const before = Date.now();

      const result = await completeXeroAuthorisation({ code: "the-code", userId: "user_admin" });

      expect(result).toEqual({ tenantName: "Org b" });

      const tokenCall = fetchCall({ index: 0 });
      expect(tokenCall.url).toBe("https://identity.xero.com/connect/token");
      expect(tokenCall.init.method).toBe("POST");
      expect(tokenCall.headers.Authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
      expect(Object.fromEntries(tokenCall.body)).toEqual({
        grant_type: "authorization_code",
        code: "the-code",
        redirect_uri: "https://app.example.com/api/xero/auth/callback",
      });

      const connectionsCall = fetchCall({ index: 1 });
      expect(connectionsCall.url).toBe("https://api.xero.com/connections");
      expect(connectionsCall.headers.Authorization).toBe(`Bearer ${accessToken}`);

      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
      const { data } = mocks.create.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(data).toEqual(
        expect.objectContaining({
          tenantId: "b",
          tenantName: "Org b",
          connectionId: "conn-b",
          userId: "user_admin",
          scopes: ["offline_access", "accounting.invoices"],
          isActive: true,
        }),
      );
      expect(data).not.toHaveProperty("accessToken");
      expect(data.accessTokenEncrypted).not.toContain(accessToken.slice(0, 20));
      expect(decrypt({ data: data as Record<string, string>, prefix: "accessToken" })).toBe(
        accessToken,
      );
      expect(decrypt({ data: data as Record<string, string>, prefix: "refreshToken" })).toBe(
        "refresh-new",
      );
      const expiry = (data.tokenExpiry as Date).getTime();
      expect(expiry).toBeGreaterThanOrEqual(before + 1800 * 1000);
      expect(expiry).toBeLessThanOrEqual(Date.now() + 1800 * 1000);
    });

    it("rejects a sign-in that connected no organisation", async () => {
      mocks.fetch
        .mockResolvedValueOnce(
          jsonResponse({ body: { access_token: accessToken, refresh_token: "r" } }),
        )
        .mockResolvedValueOnce(jsonResponse({ body: [] }));

      const error = await completeXeroAuthorisation({ code: "c", userId: "u" }).catch(
        (thrown: unknown) => thrown,
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it("fails when Xero returns no refresh token", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: { access_token: accessToken } }));

      await expect(completeXeroAuthorisation({ code: "c", userId: "u" })).rejects.toThrow(
        /offline_access/,
      );
    });

    it("fails when the code is rejected", async () => {
      mocks.fetch.mockResolvedValueOnce(
        jsonResponse({ body: { error: "invalid_client" }, status: 400 }),
      );

      await expect(completeXeroAuthorisation({ code: "c", userId: "u" })).rejects.toThrow(
        "Xero token request failed with 400 (invalid_client)",
      );
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe("getXeroAccessToken", () => {
    it("returns the stored token without refreshing while it is fresh", async () => {
      const row = connectionRow({});
      mocks.findFirst.mockResolvedValue(row);

      const token = await getXeroAccessToken();

      expect(token).toEqual({
        accessToken: "access-old",
        tenantId: "tenant-1",
        tokenExpiry: row.tokenExpiry,
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("refreshes under a row lock when the token is about to expire", async () => {
      const row = connectionRow({ tokenExpiry: new Date(Date.now() + 30 * 1000) });
      mocks.findFirst.mockResolvedValue(row);
      mocks.queryRaw.mockResolvedValue([row]);
      mocks.fetch.mockResolvedValueOnce(
        jsonResponse({
          body: {
            access_token: "access-new",
            refresh_token: "refresh-new",
            expires_in: 1800,
            scope: "offline_access accounting.invoices",
          },
        }),
      );

      const token = await getXeroAccessToken();

      expect(token.accessToken).toBe("access-new");
      expect(token.tenantId).toBe("tenant-1");
      expect(token.tokenExpiry.getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);

      const lockSql = (mocks.queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
      expect(lockSql).toContain('FROM "XeroConnection"');
      expect(lockSql).toContain("FOR UPDATE");
      expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 20000,
      });

      expect(Object.fromEntries(fetchCall({ index: 0 }).body)).toEqual({
        grant_type: "refresh_token",
        refresh_token: "refresh-old",
      });

      const { where, data } = mocks.update.mock.calls[0][0] as {
        where: unknown;
        data: Record<string, unknown>;
      };
      expect(where).toEqual({ id: 1 });
      expect(decrypt({ data: data as Record<string, string>, prefix: "accessToken" })).toBe(
        "access-new",
      );
      expect(decrypt({ data: data as Record<string, string>, prefix: "refreshToken" })).toBe(
        "refresh-new",
      );
      expect(data.tokenExpiry).toEqual(token.tokenExpiry);
      expect(data.scopes).toEqual(["offline_access", "accounting.invoices"]);
    });

    it("keeps the stored scopes when the refresh returns none", async () => {
      const row = connectionRow({ tokenExpiry: new Date(Date.now() - 1000) });
      mocks.findFirst.mockResolvedValue(row);
      mocks.queryRaw.mockResolvedValue([row]);
      mocks.fetch.mockResolvedValueOnce(
        jsonResponse({ body: { access_token: "a", refresh_token: "r" } }),
      );

      await getXeroAccessToken();

      expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("scopes");
    });

    it("uses the token another request saved while it waited for the lock", async () => {
      const stale = connectionRow({ tokenExpiry: new Date(Date.now() + 10 * 1000) });
      const refreshed = connectionRow({
        accessToken: "access-from-other-request",
        refreshToken: "refresh-from-other-request",
        tokenExpiry: new Date(Date.now() + 30 * 60 * 1000),
      });
      mocks.findFirst.mockResolvedValue(stale);
      mocks.queryRaw.mockResolvedValue([refreshed]);

      const token = await getXeroAccessToken();

      expect(token.accessToken).toBe("access-from-other-request");
      expect(token.tokenExpiry).toEqual(refreshed.tokenExpiry);
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("refreshes a token Xero rejected even though it looks fresh", async () => {
      const row = connectionRow({});
      mocks.findFirst.mockResolvedValue(row);
      mocks.queryRaw.mockResolvedValue([row]);
      mocks.fetch.mockResolvedValueOnce(
        jsonResponse({ body: { access_token: "access-new", refresh_token: "refresh-new" } }),
      );

      const token = await getXeroAccessToken({ staleExpiry: row.tokenExpiry });

      expect(token.accessToken).toBe("access-new");
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it("reuses a newer token when the rejected one was already replaced", async () => {
      const row = connectionRow({});
      mocks.findFirst.mockResolvedValue(row);

      const token = await getXeroAccessToken({ staleExpiry: new Date(Date.now() - 60 * 1000) });

      expect(token.accessToken).toBe("access-old");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("marks the connection inactive when the refresh token is rejected", async () => {
      const row = connectionRow({ tokenExpiry: new Date(Date.now() - 1000) });
      mocks.findFirst.mockResolvedValue(row);
      mocks.queryRaw.mockResolvedValue([row]);
      mocks.fetch.mockResolvedValueOnce(
        jsonResponse({ body: { error: "invalid_grant" }, status: 400 }),
      );

      const error = await getXeroAccessToken().catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(XeroReauthRequiredError);
      expect((error as XeroReauthRequiredError).status).toBe(401);
      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("passes on other refresh failures without disconnecting", async () => {
      const row = connectionRow({ tokenExpiry: new Date(Date.now() - 1000) });
      mocks.findFirst.mockResolvedValue(row);
      mocks.queryRaw.mockResolvedValue([row]);
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: {}, status: 503 }));

      await expect(getXeroAccessToken()).rejects.toThrow("Xero token request failed with 503");
      expect(mocks.updateMany).not.toHaveBeenCalled();
    });

    it("asks for a reconnect when the connection was removed while waiting", async () => {
      mocks.findFirst.mockResolvedValue(connectionRow({ tokenExpiry: new Date(0) }));
      mocks.queryRaw.mockResolvedValue([]);

      await expect(getXeroAccessToken()).rejects.toBeInstanceOf(XeroReauthRequiredError);
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.updateMany).not.toHaveBeenCalled();
    });

    it("asks for a reconnect when the tokens cannot be decrypted", async () => {
      mocks.findFirst.mockResolvedValue(connectionRow({}));
      vi.stubEnv(KEY_ENV, randomBytes(32).toString("base64"));

      const error = await getXeroAccessToken().catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(XeroReauthRequiredError);
      expect((error as Error).message).toMatch(/could not be decrypted/);
      expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("asks for a connection when Xero is not connected", async () => {
      mocks.findFirst.mockResolvedValue(null);

      const error = await getXeroAccessToken().catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(XeroReauthRequiredError);
      expect((error as Error).message).toMatch(/not connected/);
    });
  });

  describe("getXeroConnectionStatus", () => {
    it("describes the active connection", async () => {
      mocks.findFirst.mockResolvedValue({
        tenantName: "Acme Transport",
        createdAt: new Date("2026-11-01T01:00:00.000Z"),
        scopes: ["offline_access"],
        itemsSyncedAt: new Date("2026-11-02T01:00:00.000Z"),
        contactsSyncedAt: null,
      });

      expect(await getXeroConnectionStatus()).toEqual({
        configured: true,
        missingEnvVars: [],
        connected: true,
        tenantName: "Acme Transport",
        connectedAt: "2026-11-01T01:00:00.000Z",
        scopes: ["offline_access"],
        itemsSyncedAt: "2026-11-02T01:00:00.000Z",
        contactsSyncedAt: null,
      });
    });

    it("lists missing configuration when not connected", async () => {
      mocks.findFirst.mockResolvedValue(null);
      vi.stubEnv("XERO_CLIENT_ID", " ");

      expect(await getXeroConnectionStatus()).toEqual(
        expect.objectContaining({
          configured: false,
          missingEnvVars: ["XERO_CLIENT_ID"],
          connected: false,
          tenantName: null,
          scopes: [],
        }),
      );
    });
  });

  describe("disconnectXero", () => {
    it("removes the Xero connection, revokes the refresh token and deactivates it", async () => {
      mocks.findFirst.mockResolvedValue(connectionRow({ connectionId: "conn/1" }));
      mocks.fetch.mockResolvedValue(new Response(null, { status: 204 }));

      await disconnectXero();

      const removal = fetchCall({ index: 0 });
      expect(removal.url).toBe("https://api.xero.com/connections/conn%2F1");
      expect(removal.init.method).toBe("DELETE");
      expect(removal.headers.Authorization).toBe("Bearer access-old");

      const revoke = fetchCall({ index: 1 });
      expect(revoke.url).toBe("https://identity.xero.com/connect/revocation");
      expect(revoke.init.method).toBe("POST");
      expect(Object.fromEntries(revoke.body)).toEqual({ token: "refresh-old" });

      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
    });

    it("skips removing the connection when its id is unknown", async () => {
      mocks.findFirst.mockResolvedValue(connectionRow({ connectionId: null }));
      mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }));

      await disconnectXero();

      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      expect(fetchCall({ index: 0 }).url).toBe("https://identity.xero.com/connect/revocation");
    });

    it("still deactivates the connection when Xero cannot be reached", async () => {
      mocks.findFirst.mockResolvedValue(connectionRow({}));
      mocks.fetch.mockRejectedValue(new Error("network down"));

      await disconnectXero();

      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
    });

    it("still deactivates the connection when the tokens cannot be decrypted", async () => {
      mocks.findFirst.mockResolvedValue(connectionRow({}));
      vi.stubEnv(KEY_ENV, randomBytes(32).toString("base64"));

      await disconnectXero();

      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.updateMany).toHaveBeenCalled();
    });

    it("does nothing in Xero when not connected", async () => {
      mocks.findFirst.mockResolvedValue(null);

      await disconnectXero();

      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.updateMany).toHaveBeenCalled();
    });
  });
});

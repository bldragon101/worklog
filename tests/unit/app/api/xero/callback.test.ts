/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/xero/auth/callback/route";
import { ApiError } from "@/lib/api-error";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  clerkUserId: { value: "user_admin" as string | null },
  completeXeroAuthorisation: vi.fn(),
  syncXeroItemsAndContacts: vi.fn(),
  connectionFindFirst: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.clerkUserId.value }),
  clerkClient: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
  getUserRole: async () => "admin",
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ isActive: true }) },
    xeroConnection: { findFirst: mocks.connectionFindFirst },
  },
}));
vi.mock("@/lib/xero/auth", () => ({
  completeXeroAuthorisation: mocks.completeXeroAuthorisation,
}));
vi.mock("@/lib/xero/sync", () => ({
  syncXeroItemsAndContacts: mocks.syncXeroItemsAndContacts,
}));

const STATE = "state-from-connect_0123456789";
const syncResult = {
  items: 12,
  contacts: 40,
  itemsSyncedAt: "2026-11-02T00:00:00.000Z",
  contactsSyncedAt: "2026-11-02T00:00:00.000Z",
};

function callbackRequest({
  query,
  cookie = STATE,
}: {
  query: Record<string, string | undefined>;
  cookie?: string | null;
}) {
  const url = new URL("http://localhost:3000/api/xero/auth/callback");
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return new NextRequest(url, {
    headers: cookie === null ? {} : { cookie: `xero_oauth_state=${cookie}` },
  });
}

async function readPayload({ response }: { response: Response }) {
  const html = await response.text();
  const match = /postMessage\(\{ type: "xero-callback", payload: (.*) \}, window\.location\.origin\)/.exec(
    html,
  );
  if (!match) throw new Error(`No payload in callback HTML: ${html}`);
  return { html, payload: JSON.parse(match[1]) as Record<string, unknown> };
}

function expectStateCookieCleared({ response }: { response: Response }) {
  const cookie = response.headers.get("set-cookie") ?? "";
  expect(cookie).toContain("xero_oauth_state=;");
  expect(cookie).toContain("Path=/api/xero/auth");
  expect(cookie).toContain("Max-Age=0");
}

describe("GET /api/xero/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkUserId.value = "user_admin";
    mocks.checkPermission.mockResolvedValue(true);
    mocks.completeXeroAuthorisation.mockResolvedValue({ tenantName: "Acme Transport" });
    mocks.syncXeroItemsAndContacts.mockResolvedValue(syncResult);
    mocks.connectionFindFirst.mockResolvedValue({ id: 7 });
    mocks.logActivity.mockResolvedValue(undefined);
  });

  it("connects, syncs and posts the result to the opener", async () => {
    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const { html, payload } = await readPayload({ response });
    expect(payload).toEqual({
      success: true,
      tenantName: "Acme Transport",
      error: null,
      sync: syncResult,
      syncError: null,
    });
    expect(html).toContain('window.location.href = "/settings/admin/integrations"');
    expect(html).toContain("window.close()");
    expect(mocks.completeXeroAuthorisation).toHaveBeenCalledWith({
      code: "auth-code",
      userId: "user_admin",
    });
    expect(mocks.syncXeroItemsAndContacts).toHaveBeenCalledTimes(1);
    expect(mocks.checkPermission).toHaveBeenCalledWith("manage_integrations");
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        tableName: "XeroConnection",
        recordId: "7",
        description: "Connected Xero organisation: Acme Transport",
      }),
    );
    expectStateCookieCleared({ response });
  });

  it("still reports success when the first sync fails", async () => {
    mocks.syncXeroItemsAndContacts.mockRejectedValue(
      new ApiError({ status: 429, message: "Xero's rate limit was reached. Try again shortly." }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    const { payload } = await readPayload({ response });
    expect(payload).toEqual({
      success: true,
      tenantName: "Acme Transport",
      error: null,
      sync: null,
      syncError: "Xero's rate limit was reached. Try again shortly.",
    });
    expectStateCookieCleared({ response });
  });

  it("hides the detail of an unexpected sync failure", async () => {
    mocks.syncXeroItemsAndContacts.mockRejectedValue(new Error("connection reset"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    const { payload } = await readPayload({ response });
    expect(payload.success).toBe(true);
    expect(payload.syncError).toBe(
      "Items and contacts could not be synced from Xero. Use Sync to try again.",
    );
  });

  it.each([
    { name: "a different state", query: { code: "auth-code", state: "forged-state" }, cookie: STATE },
    { name: "a state of another length", query: { code: "auth-code", state: `${STATE}x` }, cookie: STATE },
    { name: "no state cookie", query: { code: "auth-code", state: STATE }, cookie: null },
    { name: "no state parameter", query: { code: "auth-code" }, cookie: STATE },
  ])("rejects $name", async ({ query, cookie }) => {
    const response = await GET(callbackRequest({ query, cookie }));

    const { payload } = await readPayload({ response });
    expect(payload).toEqual({
      success: false,
      tenantName: null,
      error: "The Xero sign-in could not be verified or has expired. Please try again.",
      sync: null,
      syncError: null,
    });
    expect(mocks.completeXeroAuthorisation).not.toHaveBeenCalled();
    expectStateCookieCleared({ response });
  });

  it("reports when Xero returns an error", async () => {
    const response = await GET(
      callbackRequest({ query: { error: "access_denied", state: STATE } }),
    );

    const { payload } = await readPayload({ response });
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Xero access was not granted. Please try again.");
    expect(mocks.completeXeroAuthorisation).not.toHaveBeenCalled();
    expectStateCookieCleared({ response });
  });

  it("reports a missing code", async () => {
    const response = await GET(callbackRequest({ query: { state: STATE } }));

    const { payload } = await readPayload({ response });
    expect(payload.error).toBe("No authorisation code received from Xero");
  });

  it("rejects parameters that are too long", async () => {
    const response = await GET(
      callbackRequest({ query: { code: "auth-code", state: STATE, error: "x".repeat(201) } }),
    );

    const { payload } = await readPayload({ response });
    expect(payload.error).toBe("Invalid callback parameters");
  });

  it("only lets administrators connect", async () => {
    mocks.checkPermission.mockResolvedValue(false);

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    const { payload } = await readPayload({ response });
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Only administrators can connect Xero");
    expect(mocks.completeXeroAuthorisation).not.toHaveBeenCalled();
    expectStateCookieCleared({ response });
  });

  it("returns the result page, not JSON, to a signed-out user", async () => {
    mocks.clerkUserId.value = null;

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    expect(response.status).toBe(200);
    const { payload } = await readPayload({ response });
    expect(payload.error).toBe("Authentication required. Please sign in and try again.");
    expect(mocks.completeXeroAuthorisation).not.toHaveBeenCalled();
    expectStateCookieCleared({ response });
  });

  it("shows the message of an expected authorisation failure", async () => {
    mocks.completeXeroAuthorisation.mockRejectedValue(
      new ApiError({ status: 400, message: "No Xero organisation was connected." }),
    );

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    const { payload } = await readPayload({ response });
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("No Xero organisation was connected.");
    expect(mocks.syncXeroItemsAndContacts).not.toHaveBeenCalled();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("hides the detail of an unexpected authorisation failure", async () => {
    mocks.completeXeroAuthorisation.mockRejectedValue(new Error("token request failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    const { payload } = await readPayload({ response });
    expect(payload.error).toBe("Failed to complete Xero authorisation");
    expectStateCookieCleared({ response });
  });

  it("escapes < in the payload so it cannot close the script", async () => {
    mocks.completeXeroAuthorisation.mockResolvedValue({
      tenantName: "</script><script>alert(1)</script>",
    });

    const response = await GET(callbackRequest({ query: { code: "auth-code", state: STATE } }));

    const { html, payload } = await readPayload({ response });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
    expect(payload.tenantName).toBe("</script><script>alert(1)</script>");
  });
});

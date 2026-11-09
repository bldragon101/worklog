/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/xero/auth/connect/route";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  clerkUserId: { value: "user_admin" as string | null },
  getMissingXeroEnvVars: vi.fn(),
  buildXeroAuthorisationUrl: vi.fn(),
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
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: async () => ({ isActive: true }) } },
}));
vi.mock("@/lib/xero/config", () => ({ getMissingXeroEnvVars: mocks.getMissingXeroEnvVars }));
vi.mock("@/lib/xero/auth", () => ({
  buildXeroAuthorisationUrl: mocks.buildXeroAuthorisationUrl,
}));

const url = "http://localhost:3000/api/xero/auth/connect";

describe("GET /api/xero/auth/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.clerkUserId.value = "user_admin";
    mocks.checkPermission.mockResolvedValue(true);
    mocks.getMissingXeroEnvVars.mockReturnValue([]);
    mocks.buildXeroAuthorisationUrl.mockImplementation(
      ({ state }: { state: string }) => `https://login.xero.com/authorize?state=${state}`,
    );
  });

  it("returns the sign-in URL and stores its state in an httpOnly cookie", async () => {
    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(200);
    const { authUrl } = (await response.json()) as { authUrl: string };
    const state = new URL(authUrl).searchParams.get("state") ?? "";
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.buildXeroAuthorisationUrl).toHaveBeenCalledWith({ state });

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`xero_oauth_state=${state}`);
    expect(cookie).toContain("Path=/api/xero/auth");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).not.toContain("Secure");
  });

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(new NextRequest(url));

    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("uses a new state for every sign-in", async () => {
    await GET(new NextRequest(url));
    await GET(new NextRequest(url));

    const [first, second] = mocks.buildXeroAuthorisationUrl.mock.calls.map(
      (call) => (call[0] as { state: string }).state,
    );
    expect(first).not.toBe(second);
  });

  it("responds 400 with the missing variables when Xero is not configured", async () => {
    mocks.getMissingXeroEnvVars.mockReturnValue(["XERO_CLIENT_ID", "XERO_ENCRYPTION_KEY"]);

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Xero is not configured. Set XERO_CLIENT_ID, XERO_ENCRYPTION_KEY.",
      missingEnvVars: ["XERO_CLIENT_ID", "XERO_ENCRYPTION_KEY"],
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.buildXeroAuthorisationUrl).not.toHaveBeenCalled();
  });

  it("forbids users without the manage_integrations permission", async () => {
    mocks.checkPermission.mockResolvedValue(false);

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(403);
    expect(mocks.checkPermission).toHaveBeenCalledWith("manage_integrations");
    expect(mocks.buildXeroAuthorisationUrl).not.toHaveBeenCalled();
  });

  it("requires sign-in", async () => {
    mocks.clerkUserId.value = null;

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(401);
  });
});

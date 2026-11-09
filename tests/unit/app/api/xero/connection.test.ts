/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST as disconnect } from "@/app/api/xero/auth/disconnect/route";
import { GET as getStatus } from "@/app/api/xero/auth/status/route";
import { POST as sync } from "@/app/api/xero/sync/route";
import { XeroReauthRequiredError } from "@/lib/xero/auth";
import { XeroRateLimitError } from "@/lib/xero/client";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  clerkUserId: { value: "user_admin" as string | null },
  disconnectXero: vi.fn(),
  getXeroConnectionStatus: vi.fn(),
  syncXeroItemsAndContacts: vi.fn(),
  rateLimitNames: [] as unknown[],
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
  createRateLimiter: (config: unknown) => {
    mocks.rateLimitNames.push(config);
    return () => ({ headers: { "X-RateLimit-Limit": "20" } });
  },
  rateLimitConfigs: { general: "general", export: "export" },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: async () => ({ isActive: true }) } },
}));
vi.mock("@/lib/xero/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/xero/auth")>()),
  disconnectXero: mocks.disconnectXero,
  getXeroConnectionStatus: mocks.getXeroConnectionStatus,
}));
vi.mock("@/lib/xero/sync", () => ({
  syncXeroItemsAndContacts: mocks.syncXeroItemsAndContacts,
}));

const baseUrl = "http://localhost:3000/api/xero";

const status = {
  configured: true,
  missingEnvVars: [],
  connected: true,
  tenantName: "Acme Transport",
  connectedAt: "2026-11-01T00:00:00.000Z",
  scopes: ["offline_access"],
  itemsSyncedAt: null,
  contactsSyncedAt: null,
};

describe("Xero connection routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkUserId.value = "user_admin";
    mocks.checkPermission.mockResolvedValue(true);
    mocks.disconnectXero.mockResolvedValue(undefined);
    mocks.getXeroConnectionStatus.mockResolvedValue(status);
  });

  describe("POST /api/xero/auth/disconnect", () => {
    const request = () => new NextRequest(`${baseUrl}/auth/disconnect`, { method: "POST" });

    it("disconnects Xero", async () => {
      const response = await disconnect(request());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mocks.disconnectXero).toHaveBeenCalledTimes(1);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_integrations");
    });

    it("forbids users without the manage_integrations permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await disconnect(request());

      expect(response.status).toBe(403);
      expect(mocks.disconnectXero).not.toHaveBeenCalled();
    });

    it("requires sign-in", async () => {
      mocks.clerkUserId.value = null;

      const response = await disconnect(request());

      expect(response.status).toBe(401);
      expect(mocks.disconnectXero).not.toHaveBeenCalled();
    });

    it("responds 500 when the disconnect fails", async () => {
      mocks.disconnectXero.mockRejectedValue(new Error("database down"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await disconnect(request());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: "Failed to disconnect Xero",
      });
    });
  });

  describe("GET /api/xero/auth/status", () => {
    it("returns the connection status without a wrapper", async () => {
      const response = await getStatus(new NextRequest(`${baseUrl}/auth/status`));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(status);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await getStatus(new NextRequest(`${baseUrl}/auth/status`));

      expect(response.status).toBe(403);
      expect(mocks.getXeroConnectionStatus).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/xero/sync", () => {
    const request = () => new NextRequest(`${baseUrl}/sync`, { method: "POST" });

    it("returns the sync result under the export rate limit", async () => {
      const result = {
        items: 3,
        contacts: 5,
        itemsSyncedAt: "2026-11-02T00:00:00.000Z",
        contactsSyncedAt: "2026-11-02T00:00:00.000Z",
      };
      mocks.syncXeroItemsAndContacts.mockResolvedValue(result);

      const response = await sync(request());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(result);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("20");
      expect(mocks.rateLimitNames).toContain("export");
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await sync(request());

      expect(response.status).toBe(403);
      expect(mocks.syncXeroItemsAndContacts).not.toHaveBeenCalled();
    });

    it("responds 401 with a code when Xero must be reconnected", async () => {
      mocks.syncXeroItemsAndContacts.mockRejectedValue(new XeroReauthRequiredError());

      const response = await sync(request());

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(
        expect.objectContaining({ success: false, code: "XERO_REAUTH_REQUIRED" }),
      );
    });

    it("responds 429 when Xero's rate limit is hit", async () => {
      mocks.syncXeroItemsAndContacts.mockRejectedValue(
        new XeroRateLimitError({ retryAfterSeconds: 30 }),
      );

      const response = await sync(request());

      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({
        success: false,
        code: "XERO_RATE_LIMITED",
        retryAfterSeconds: 30,
        error: "Xero's rate limit was reached. Try again in 30 seconds.",
      });
    });

    it("responds 500 on an unexpected failure", async () => {
      mocks.syncXeroItemsAndContacts.mockRejectedValue(new Error("boom"));
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await sync(request());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Failed to sync from Xero" });
    });
  });
});

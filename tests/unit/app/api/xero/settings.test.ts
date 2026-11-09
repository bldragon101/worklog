/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/xero/settings/route";
import { ApiError } from "@/lib/api-error";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  clerkUserId: { value: "user_admin" as string | null },
  getXeroSettings: vi.fn(),
  saveXeroSettings: vi.fn(),
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
  rateLimitConfigs: { general: {}, settings: {} },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: async () => ({ isActive: true }) } },
}));
vi.mock("@/lib/xero/invoice-context", () => ({ getXeroSettings: mocks.getXeroSettings }));
vi.mock("@/lib/xero/mappings", () => ({ saveXeroSettings: mocks.saveXeroSettings }));

const url = "http://localhost:3000/api/xero/settings";

const settings = {
  salesAccountCode: "200",
  taxType: "OUTPUT",
  breakItemCode: "Break",
  eastlinkItemCode: "EL",
  citylinkItemCode: "CL",
  fuelLevyItemCode: "Fuel Levy",
};

function patchRequest({ body }: { body: unknown }) {
  return new NextRequest(url, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/xero/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkUserId.value = "user_admin";
    mocks.checkPermission.mockResolvedValue(true);
    mocks.getXeroSettings.mockResolvedValue(settings);
    mocks.saveXeroSettings.mockImplementation(
      async ({ settings: saved }: { settings: unknown }) => saved,
    );
  });

  describe("GET", () => {
    it("returns the settings", async () => {
      const response = await GET(new NextRequest(url));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(settings);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await GET(new NextRequest(url));

      expect(response.status).toBe(403);
      expect(mocks.getXeroSettings).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("saves the trimmed settings, with blank item codes as null", async () => {
      const response = await PATCH(
        patchRequest({
          body: {
            ...settings,
            salesAccountCode: " 210 ",
            breakItemCode: "  ",
            fuelLevyItemCode: null,
          },
        }),
      );

      const saved = {
        ...settings,
        salesAccountCode: "210",
        breakItemCode: null,
        fuelLevyItemCode: null,
      };
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(saved);
      expect(mocks.saveXeroSettings).toHaveBeenCalledWith({ settings: saved, userId: "user_admin" });
    });

    it.each([
      { name: "a missing account code", body: { ...settings, salesAccountCode: "" } },
      { name: "a missing tax type", body: { ...settings, taxType: undefined } },
      { name: "a missing item code field", body: { ...settings, eastlinkItemCode: undefined } },
      { name: "an item code that is too long", body: { ...settings, citylinkItemCode: "x".repeat(31) } },
    ])("rejects $name", async ({ body }) => {
      const response = await PATCH(patchRequest({ body }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: "Invalid Xero settings" }),
      );
      expect(mocks.saveXeroSettings).not.toHaveBeenCalled();
    });

    it("rejects a body that is not JSON", async () => {
      const response = await PATCH(patchRequest({ body: "nope" }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    });

    it("passes on an unknown item code", async () => {
      mocks.saveXeroSettings.mockRejectedValue(
        new ApiError({ status: 400, message: "Item code not in Xero: Break" }),
      );

      const response = await PATCH(patchRequest({ body: settings }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Item code not in Xero: Break" });
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await PATCH(patchRequest({ body: settings }));

      expect(response.status).toBe(403);
      expect(mocks.saveXeroSettings).not.toHaveBeenCalled();
    });
  });
});

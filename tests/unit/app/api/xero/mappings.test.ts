/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/xero/mappings/route";
import { PUT as putCompanies } from "@/app/api/xero/mappings/companies/route";
import { PUT as putContacts } from "@/app/api/xero/mappings/contacts/route";
import { PUT as putVehicles } from "@/app/api/xero/mappings/vehicles/route";
import { ApiError } from "@/lib/api-error";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  clerkUserId: { value: "user_admin" as string | null },
  getXeroMappings: vi.fn(),
  saveVehicleItemMappings: vi.fn(),
  saveCompanyItemMappings: vi.fn(),
  saveContactMappings: vi.fn(),
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
vi.mock("@/lib/xero/mappings", () => ({
  getXeroMappings: mocks.getXeroMappings,
  saveVehicleItemMappings: mocks.saveVehicleItemMappings,
  saveCompanyItemMappings: mocks.saveCompanyItemMappings,
  saveContactMappings: mocks.saveContactMappings,
}));

const baseUrl = "http://localhost:3000/api/xero/mappings";
const mappingsResponse = { items: [], contacts: [], vehicles: [], companies: [] };

function putRequest({ path, body }: { path: string; body: unknown }) {
  return new NextRequest(`${baseUrl}/${path}`, {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const routes: Array<{
  name: string;
  put: (request: NextRequest) => Promise<Response>;
  save: ReturnType<typeof vi.fn>;
  validBody: unknown;
  savedMappings: unknown[];
  invalidBodies: unknown[];
  validationMessage: string;
}> = [
  {
    name: "vehicles",
    put: putVehicles,
    save: mocks.saveVehicleItemMappings,
    validBody: { mappings: [{ registration: " abc 123 ", itemCode: " 14TT - 01 " }] },
    savedMappings: [{ registration: "abc 123", itemCode: "14TT - 01" }],
    invalidBodies: [
      { mappings: [] },
      { mappings: [{ registration: "", itemCode: "14TT - 01" }] },
      { mappings: [{ registration: "ABC123", itemCode: "" }] },
      { mappings: [{ registration: "ABC123" }] },
    ],
    validationMessage: "Invalid vehicle mappings",
  },
  {
    name: "companies",
    put: putCompanies,
    save: mocks.saveCompanyItemMappings,
    validBody: { mappings: [{ companyName: "Blue Hawk", truckClass: "crane", itemCode: null }] },
    savedMappings: [{ companyName: "Blue Hawk", truckClass: "crane", itemCode: null }],
    invalidBodies: [
      { mappings: [{ companyName: "Blue Hawk", truckClass: "ute", itemCode: "12TC - 01" }] },
      { mappings: [{ companyName: " ", truckClass: "tray", itemCode: "14TT - 01" }] },
      { mappings: "nope" },
    ],
    validationMessage: "Invalid company mappings",
  },
  {
    name: "contacts",
    put: putContacts,
    save: mocks.saveContactMappings,
    validBody: { mappings: [{ billTo: "Acme Pty Ltd", contactId: "c-1" }] },
    savedMappings: [{ billTo: "Acme Pty Ltd", contactId: "c-1" }],
    invalidBodies: [
      { mappings: [{ billTo: "Acme Pty Ltd", contactId: "" }] },
      { mappings: [{ billTo: "x".repeat(201), contactId: "c-1" }] },
      {},
    ],
    validationMessage: "Invalid contact mappings",
  },
];

describe("Xero mapping routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkUserId.value = "user_admin";
    mocks.checkPermission.mockResolvedValue(true);
    mocks.getXeroMappings.mockResolvedValue(mappingsResponse);
    mocks.saveVehicleItemMappings.mockResolvedValue(undefined);
    mocks.saveCompanyItemMappings.mockResolvedValue(undefined);
    mocks.saveContactMappings.mockResolvedValue(undefined);
  });

  describe("GET /api/xero/mappings", () => {
    it("returns the mappings", async () => {
      const response = await GET(new NextRequest(baseUrl));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(mappingsResponse);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await GET(new NextRequest(baseUrl));

      expect(response.status).toBe(403);
      expect(mocks.getXeroMappings).not.toHaveBeenCalled();
    });

    it("requires sign-in", async () => {
      mocks.clerkUserId.value = null;

      const response = await GET(new NextRequest(baseUrl));

      expect(response.status).toBe(401);
    });
  });

  describe.each(routes)("PUT /api/xero/mappings/$name", (route) => {
    it("saves the parsed mappings and returns the refreshed mappings", async () => {
      const response = await route.put(putRequest({ path: route.name, body: route.validBody }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(mappingsResponse);
      expect(route.save).toHaveBeenCalledWith({
        mappings: route.savedMappings,
        userId: "user_admin",
      });
      expect(mocks.getXeroMappings).toHaveBeenCalledTimes(1);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
    });

    it.each(route.invalidBodies.map((body) => ({ body })))("rejects the invalid body $body", async ({ body }) => {
      const response = await route.put(putRequest({ path: route.name, body }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: route.validationMessage }),
      );
      expect(route.save).not.toHaveBeenCalled();
    });

    it("rejects a body that is not JSON", async () => {
      const response = await route.put(putRequest({ path: route.name, body: "{not json" }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid JSON body" });
      expect(route.save).not.toHaveBeenCalled();
    });

    it("passes on a rejection from the save", async () => {
      route.save.mockRejectedValue(
        new ApiError({ status: 400, message: "Item code not in Xero: NOPE" }),
      );

      const response = await route.put(putRequest({ path: route.name, body: route.validBody }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Item code not in Xero: NOPE" });
      expect(mocks.getXeroMappings).not.toHaveBeenCalled();
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await route.put(putRequest({ path: route.name, body: route.validBody }));

      expect(response.status).toBe(403);
      expect(route.save).not.toHaveBeenCalled();
    });
  });
});

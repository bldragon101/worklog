/**
 * @vitest-environment node
 */

const {
  mockRequireAuthFn,
  mockGetUserRoleFn,
  mockRateLimitFn,
  mockFindFirstFn,
  mockUpdateFn,
} = vi.hoisted(() => ({
  mockRequireAuthFn: vi.fn(),
  mockGetUserRoleFn: vi.fn(),
  mockRateLimitFn: vi.fn(),
  mockFindFirstFn: vi.fn(),
  mockUpdateFn: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mockRequireAuthFn }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: vi.fn(() => mockRateLimitFn),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/permissions", () => ({ getUserRole: mockGetUserRoleFn }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    companySettings: { findFirst: mockFindFirstFn, update: mockUpdateFn },
  },
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/admin/toll-rate-settings/route";

const url = "http://localhost:3000/api/admin/toll-rate-settings";

function patchRequest({ body }: { body: unknown }) {
  return new NextRequest(url, { method: "PATCH", body: JSON.stringify(body) });
}

/** Prisma returns Decimal columns as objects; the route converts them to numbers */
function decimal({ value }: { value: number }) {
  return { toString: () => value.toFixed(2), valueOf: () => value };
}

describe("/api/admin/toll-rate-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitFn.mockReturnValue({ headers: {} });
    mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });
    mockGetUserRoleFn.mockResolvedValue("admin");
  });

  it("returns the default rates when company settings are not configured", async () => {
    mockFindFirstFn.mockResolvedValue(null);

    const response = await GET(new NextRequest(url));

    expect(await response.json()).toEqual({
      eastlink: 18.5,
      citylink: 31,
      companySettingsConfigured: false,
    });
  });

  it("returns the saved rates as numbers", async () => {
    mockFindFirstFn.mockResolvedValue({
      tollEastlinkRate: decimal({ value: 19.45 }),
      tollCitylinkRate: decimal({ value: 34.9 }),
    });

    const response = await GET(new NextRequest(url));

    expect(await response.json()).toEqual({
      eastlink: 19.45,
      citylink: 34.9,
      companySettingsConfigured: true,
    });
  });

  it("forbids non-admins from changing the rates", async () => {
    mockGetUserRoleFn.mockResolvedValue("manager");

    const response = await PATCH(
      patchRequest({ body: { eastlink: 20, citylink: 35 } }),
    );

    expect(response.status).toBe(403);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a negative rate", body: { eastlink: -1, citylink: 31 } },
    { name: "more than two decimal places", body: { eastlink: 18.555, citylink: 31 } },
    { name: "a missing rate", body: { eastlink: 18.5 } },
    { name: "a rate given as text", body: { eastlink: "18.50", citylink: 31 } },
  ])("rejects $name", async ({ body }) => {
    const response = await PATCH(patchRequest({ body }));

    expect(response.status).toBe(400);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("requires company settings before saving", async () => {
    mockFindFirstFn.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ body: { eastlink: 20, citylink: 35 } }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("saves the rates for admins", async () => {
    mockFindFirstFn.mockResolvedValue({ id: 1 });
    mockUpdateFn.mockResolvedValue({
      tollEastlinkRate: decimal({ value: 19.45 }),
      tollCitylinkRate: decimal({ value: 34.9 }),
    });

    const response = await PATCH(
      patchRequest({ body: { eastlink: 19.45, citylink: 34.9 } }),
    );

    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { tollEastlinkRate: 19.45, tollCitylinkRate: 34.9 },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eastlink: 19.45,
      citylink: 34.9,
      companySettingsConfigured: true,
    });
  });
});

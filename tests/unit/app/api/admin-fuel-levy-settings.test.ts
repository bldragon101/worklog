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
import { GET, PATCH } from "@/app/api/admin/fuel-levy-settings/route";

const url = "http://localhost:3000/api/admin/fuel-levy-settings";

describe("/api/admin/fuel-levy-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitFn.mockReturnValue({ headers: {} });
    mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });
    mockGetUserRoleFn.mockResolvedValue("admin");
  });

  it("reports when company settings are not configured", async () => {
    mockFindFirstFn.mockResolvedValue(null);

    const response = await GET(new NextRequest(url));

    expect(await response.json()).toEqual({
      defaultFuelLevy: null,
      companySettingsConfigured: false,
    });
  });

  it("returns the saved default fuel levy", async () => {
    mockFindFirstFn.mockResolvedValue({ defaultFuelLevy: 15.69 });

    const response = await GET(new NextRequest(url));

    expect(await response.json()).toEqual({
      defaultFuelLevy: 15.69,
      companySettingsConfigured: true,
    });
  });

  it("forbids non-admins from changing the default", async () => {
    mockGetUserRoleFn.mockResolvedValue("manager");

    const response = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ defaultFuelLevy: 12 }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("saves the default fuel levy for admins", async () => {
    mockFindFirstFn.mockResolvedValue({ id: 1 });
    mockUpdateFn.mockResolvedValue({ defaultFuelLevy: 12.5 });

    const response = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ defaultFuelLevy: 12.5 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      defaultFuelLevy: 12.5,
      companySettingsConfigured: true,
    });
  });
});

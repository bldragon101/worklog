/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti-deductions/route";
import { prisma } from "@/lib/prisma";
import { applyOverridesToPending } from "@/lib/utils/deduction-overrides";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driver: { findUnique: vi.fn() },
    rctiDeduction: { create: vi.fn() },
  },
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: async () => true,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: new Headers({ "X-RateLimit-Limit": "100" }),
  }),
  rateLimitConfigs: { general: {} },
}));

function createRequest() {
  return new NextRequest("http://localhost/api/rcti-deductions", {
    method: "POST",
    body: JSON.stringify({
      driverId: 7,
      type: "deduction",
      description: "Uniform",
      totalAmount: 120,
      frequency: "monthly",
      amountPerCycle: 40,
      startDate: "2026-11-23",
    }),
  });
}

describe("POST /api/rcti-deductions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.rctiDeduction.create).mockResolvedValue({
      id: 1,
    } as never);
  });

  it.each([["Employee"], ["Contractor"], ["Subcontractor"]])(
    "creates a deduction for an %s, since jobs reports cover every driver type",
    async (type) => {
      vi.mocked(prisma.driver.findUnique).mockResolvedValue({
        id: 7,
        type,
      } as never);

      const response = await POST(createRequest(), {
        params: Promise.resolve({}),
      });

      expect(response.status).toBe(201);
      expect(prisma.rctiDeduction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driverId: 7,
            frequency: "monthly",
            amountPerCycle: 40,
          }),
        }),
      );
    },
  );

  it("returns 404 for an unknown driver", async () => {
    vi.mocked(prisma.driver.findUnique).mockResolvedValue(null);

    const response = await POST(createRequest(), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(404);
    expect(prisma.rctiDeduction.create).not.toHaveBeenCalled();
  });
});

describe("applyOverridesToPending", () => {
  const pending = [
    { id: 1, amountToApply: 50, amountRemaining: 200 },
    { id: 2, amountToApply: 30, amountRemaining: 30 },
    { id: 3, amountToApply: 10, amountRemaining: 100 },
  ];

  it("leaves skipped items out, replaces adjusted amounts and keeps the rest", () => {
    const result = applyOverridesToPending({
      pending,
      overrides: new Map([
        [1, null],
        [2, 20],
      ]),
    });

    expect(result).toEqual([
      { id: 2, amountToApply: 20, amountRemaining: 30 },
      { id: 3, amountToApply: 10, amountRemaining: 100 },
    ]);
  });

  it("caps an adjusted amount at what is still owed", () => {
    const result = applyOverridesToPending({
      pending,
      overrides: new Map([[2, 75]]),
    });

    expect(result[1]).toEqual({ id: 2, amountToApply: 30, amountRemaining: 30 });
  });
});

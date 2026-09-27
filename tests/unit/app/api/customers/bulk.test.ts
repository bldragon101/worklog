/**
 * @vitest-environment node
 */

const {
  mockRequireAuthFn,
  mockGetUserRoleFn,
  mockRateLimitFn,
  mockLogActivityFn,
  mockFindManyFn,
  mockUpdateManyFn,
} = vi.hoisted(() => ({
  mockRequireAuthFn: vi.fn(),
  mockGetUserRoleFn: vi.fn(),
  mockRateLimitFn: vi.fn(),
  mockLogActivityFn: vi.fn(),
  mockFindManyFn: vi.fn(),
  mockUpdateManyFn: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuthFn,
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: vi.fn(() => mockRateLimitFn),
  rateLimitConfigs: { general: {} },
}));

vi.mock("@/lib/permissions", () => ({
  getUserRole: mockGetUserRoleFn,
}));

vi.mock("@/lib/activity-logger", () => ({
  logActivity: mockLogActivityFn,
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    customer: { findMany: mockFindManyFn, updateMany: mockUpdateManyFn },
  };
  return {
    prisma: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    },
  };
});

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/customers/bulk/route";

const makeRequest = ({ body }: { body: unknown }) =>
  new NextRequest("http://localhost:3000/api/customers/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const customer = ({ id }: { id: number }) => ({
  id,
  customer: `Customer ${id}`,
  billTo: `Bill To ${id}`,
  tray: 100,
  crane: 150,
  semi: 200,
  semiCrane: 250,
  fuelLevy: 10,
  tolls: false,
});

describe("PATCH /api/customers/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitFn.mockReturnValue({ headers: {} });
    mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });
    mockGetUserRoleFn.mockResolvedValue("admin");
    mockLogActivityFn.mockResolvedValue(undefined);
    mockUpdateManyFn.mockResolvedValue({ count: 2 });
  });

  it("returns the rate limit response when limited", async () => {
    mockRateLimitFn.mockReturnValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const response = await PATCH(
      makeRequest({ body: { customerIds: [1], updates: { tolls: true } } }),
    );

    expect(response.status).toBe(429);
    expect(mockRequireAuthFn).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    mockRequireAuthFn.mockResolvedValue(
      NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
    );

    const response = await PATCH(
      makeRequest({ body: { customerIds: [1], updates: { tolls: true } } }),
    );

    expect(response.status).toBe(401);
    expect(mockUpdateManyFn).not.toHaveBeenCalled();
  });

  it.each(["manager", "user", "viewer"])(
    "forbids %s users from bulk updating",
    async (role) => {
      mockGetUserRoleFn.mockResolvedValue(role);

      const response = await PATCH(
        makeRequest({ body: { customerIds: [1], updates: { tolls: true } } }),
      );

      expect(response.status).toBe(403);
      expect(mockUpdateManyFn).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid JSON body", async () => {
    const response = await PATCH(makeRequest({ body: "not json" }));
    expect(response.status).toBe(400);
  });

  it("rejects a request with no fields to update", async () => {
    const response = await PATCH(
      makeRequest({ body: { customerIds: [1], updates: {} } }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateManyFn).not.toHaveBeenCalled();
  });

  it("rejects fields other than rates, fuel levy and tolls", async () => {
    const response = await PATCH(
      makeRequest({
        body: { customerIds: [1], updates: { customer: "Renamed" } },
      }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateManyFn).not.toHaveBeenCalled();
  });

  it("returns 404 when a selected customer no longer exists", async () => {
    mockFindManyFn.mockResolvedValueOnce([customer({ id: 1 })]);

    const response = await PATCH(
      makeRequest({ body: { customerIds: [1, 2], updates: { tolls: true } } }),
    );

    expect(response.status).toBe(404);
    expect(mockUpdateManyFn).not.toHaveBeenCalled();
  });

  it("updates only the provided fields and logs each customer", async () => {
    const before = [customer({ id: 1 }), customer({ id: 2 })];
    const after = before.map((c) => ({
      ...c,
      tray: 180,
      fuelLevy: 15.69,
      tolls: true,
    }));
    mockFindManyFn.mockResolvedValueOnce(before).mockResolvedValueOnce(after);

    const updates = { tray: 180, fuelLevy: 15.69, tolls: true };
    const response = await PATCH(
      makeRequest({ body: { customerIds: [1, 2, 2], updates } }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.updatedCount).toBe(2);
    expect(mockUpdateManyFn).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: updates,
    });
    expect(mockLogActivityFn).toHaveBeenCalledTimes(2);
    expect(mockLogActivityFn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        tableName: "Customer",
        recordId: "1",
        description: "Bulk updated customer fields: tray, fuelLevy, tolls",
      }),
    );
  });
});

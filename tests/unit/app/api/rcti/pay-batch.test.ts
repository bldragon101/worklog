/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/pay-batch/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/prisma", () => {
  const client = {
    rcti: {
      findMany: vi.fn(),
      updateManyAndReturn: vi.fn(),
    },
    rctiStatusChange: {
      createMany: vi.fn(),
    },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(client),
  };
  return { prisma: client };
});

function paidRows({ ids }: { ids: number[] }) {
  return ids.map((id) => ({ id }));
}

vi.mock("@/lib/permissions", () => ({
  checkPermission: async () => true,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    },
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

describe("RCTI Batch Pay API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: unknown) => {
    return new NextRequest("http://localhost:3000/api/rcti/pay-batch", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  describe("Successful bulk payment", () => {
    it("marks all finalised RCTIs as paid", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
        { id: 2, status: "finalised", invoiceNumber: "RCTI-2" },
      ]);
      (prisma.rcti.updateManyAndReturn as vi.Mock).mockResolvedValue(
        paidRows({ ids: [1, 2] }),
      );

      const request = createMockRequest({ ids: [1, 2] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paidCount).toBe(2);
      expect(data.attemptedIds).toEqual([1, 2]);
      expect(data.skipped).toEqual([]);

      expect(prisma.rcti.updateManyAndReturn).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] }, status: "finalised" },
        data: expect.objectContaining({ status: "paid" }),
        select: { id: true },
      });
      expect(prisma.rctiStatusChange.createMany).toHaveBeenCalledWith({
        data: [1, 2].map((rctiId) => ({
          rctiId,
          fromStatus: "finalised",
          toStatus: "paid",
          changedBy: "test-user-123",
          changedAt: expect.any(Date),
        })),
      });
    });

    it("sets paidAt when marking as paid", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateManyAndReturn as vi.Mock).mockResolvedValue(
        paidRows({ ids: [1] }),
      );

      const request = createMockRequest({ ids: [1] });
      await POST(request);

      const callArg = (prisma.rcti.updateManyAndReturn as vi.Mock).mock.calls[0][0];
      expect(callArg.data.paidAt).toBeInstanceOf(Date);
    });

    it("de-duplicates repeated ids in the request", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateManyAndReturn as vi.Mock).mockResolvedValue(
        paidRows({ ids: [1] }),
      );

      const request = createMockRequest({ ids: [1, 1, 1] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prisma.rcti.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        select: { id: true, status: true, invoiceNumber: true },
      });
    });
  });

  describe("Skipping ineligible RCTIs", () => {
    it("skips draft and already-paid RCTIs but pays finalised ones", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
        { id: 2, status: "draft", invoiceNumber: "RCTI-2" },
        { id: 3, status: "paid", invoiceNumber: "RCTI-3" },
      ]);
      (prisma.rcti.updateManyAndReturn as vi.Mock).mockResolvedValue(
        paidRows({ ids: [1] }),
      );

      const request = createMockRequest({ ids: [1, 2, 3] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paidCount).toBe(1);
      expect(data.attemptedIds).toEqual([1]);
      expect(data.skipped).toContainEqual({
        id: 2,
        reason: "Only finalised RCTIs can be marked as paid",
      });
      expect(data.skipped).toContainEqual({
        id: 3,
        reason: "Already marked as paid",
      });
    });

    it("reports ids that were not found", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateManyAndReturn as vi.Mock).mockResolvedValue(
        paidRows({ ids: [1] }),
      );

      const request = createMockRequest({ ids: [1, 999] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paidCount).toBe(1);
      expect(data.skipped).toContainEqual({
        id: 999,
        reason: "RCTI not found",
      });
    });

    it("does not update anything when no RCTIs are eligible", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "draft", invoiceNumber: "RCTI-1" },
      ]);

      const request = createMockRequest({ ids: [1] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paidCount).toBe(0);
      expect(prisma.rcti.updateManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe("Validation errors", () => {
    it("rejects an empty ids array", async () => {
      const request = createMockRequest({ ids: [] });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid request data");
    });

    it("rejects a missing ids field", async () => {
      const request = createMockRequest({});
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("rejects non-positive ids", async () => {
      const request = createMockRequest({ ids: [0, -1] });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("rejects non-integer ids", async () => {
      const request = createMockRequest({ ids: [1.5] });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("rejects more than 100 ids", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);
      const request = createMockRequest({ ids });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("rejects a non-JSON body", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/rcti/pay-batch",
        {
          method: "POST",
          body: "not json",
          headers: { "Content-Type": "application/json" },
        },
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when the database query fails", async () => {
      (prisma.rcti.findMany as vi.Mock).mockRejectedValue(
        new Error("Database connection error"),
      );

      const request = createMockRequest({ ids: [1] });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to mark RCTIs as paid");
    });

    it("returns 500 when the update fails", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateManyAndReturn as vi.Mock).mockRejectedValue(
        new Error("Update failed"),
      );

      const request = createMockRequest({ ids: [1] });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to mark RCTIs as paid");
    });
  });
});

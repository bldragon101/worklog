/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/pay-batch/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
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
      (prisma.rcti.updateMany as vi.Mock).mockResolvedValue({ count: 2 });

      const request = createMockRequest({ ids: [1, 2] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paidCount).toBe(2);
      expect(data.attemptedIds).toEqual([1, 2]);
      expect(data.skipped).toEqual([]);

      expect(prisma.rcti.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] }, status: "finalised" },
        data: expect.objectContaining({ status: "paid" }),
      });
    });

    it("sets paidAt when marking as paid", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateMany as vi.Mock).mockResolvedValue({ count: 1 });

      const request = createMockRequest({ ids: [1] });
      await POST(request);

      const callArg = (prisma.rcti.updateMany as vi.Mock).mock.calls[0][0];
      expect(callArg.data.paidAt).toBeInstanceOf(Date);
    });

    it("de-duplicates repeated ids in the request", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateMany as vi.Mock).mockResolvedValue({ count: 1 });

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
      (prisma.rcti.updateMany as vi.Mock).mockResolvedValue({ count: 1 });

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
      (prisma.rcti.updateMany as vi.Mock).mockResolvedValue({ count: 1 });

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

    it("does not call updateMany when no RCTIs are eligible", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "draft", invoiceNumber: "RCTI-1" },
      ]);

      const request = createMockRequest({ ids: [1] });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paidCount).toBe(0);
      expect(prisma.rcti.updateMany).not.toHaveBeenCalled();
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

    it("returns 500 when updateMany fails", async () => {
      (prisma.rcti.findMany as vi.Mock).mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      (prisma.rcti.updateMany as vi.Mock).mockRejectedValue(
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

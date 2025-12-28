/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/[id]/revert/route";
import { prisma } from "@/lib/prisma";
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    rctiLine: {
      findMany: jest.fn(),
    },
    rctiStatusChange: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

jest.mock("@/lib/rate-limit", () => ({
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

jest.mock("@/lib/rcti-deductions", () => ({
  removeDeductionsFromRcti: jest.fn(),
}));

describe("RCTI Revert to Draft API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (id: string, body: unknown) => {
    return new NextRequest(`http://localhost:3000/api/rcti/${id}/revert`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  const mockPaidRcti = {
    id: 1,
    invoiceNumber: "RCTI-20012025",
    driverId: 10,
    driverName: "John Smith",
    weekEnding: new Date("2025-01-20"),
    status: "paid",
    subtotal: 1000.0,
    gst: 100.0,
    total: 1100.0,
    paidAt: new Date("2025-01-25"),
    revertedToDraftAt: null,
    revertedToDraftReason: null,
    lines: [
      {
        id: 1,
        rctiId: 1,
        jobDate: new Date("2025-01-15"),
        customer: "Test Customer",
        chargedHours: 10,
        ratePerHour: 100,
        amountExGst: 1000.0,
        gstAmount: 100.0,
        amountIncGst: 1100.0,
      },
    ],
  };

  const mockRctiLines = [
    {
      id: 1,
      rctiId: 1,
      jobDate: new Date("2025-01-15"),
      customer: "Test Customer",
      chargedHours: 10,
      ratePerHour: 100,
      amountExGst: 1000.0,
      gstAmount: 100.0,
      amountIncGst: 1100.0,
    },
  ];

  describe("Successful revert scenarios", () => {
    it("should revert a paid RCTI to draft with valid reason", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);

      const revertedRcti = {
        ...mockPaidRcti,
        status: "draft",
        paidAt: null,
        revertedToDraftAt: new Date("2025-01-26"),
        revertedToDraftReason: "Payment cancelled by customer",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        lines: mockRctiLines,
        statusChanges: [
          {
            id: 1,
            rctiId: 1,
            fromStatus: "paid",
            toStatus: "draft",
            reason: "Payment cancelled by customer",
            changedBy: "test-user-123",
            changedAt: new Date("2025-01-26"),
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback(prisma),
      );
      (prisma.rcti.update as jest.Mock).mockResolvedValue(revertedRcti);

      const request = createMockRequest("1", {
        reason: "Payment cancelled by customer",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(removeDeductionsFromRcti).toHaveBeenCalledWith({ rctiId: 1 });

      const data = await response.json();
      expect(data.status).toBe("draft");
      expect(data.paidAt).toBeNull();
      expect(data.revertedToDraftReason).toBe("Payment cancelled by customer");
      expect(data.statusChanges).toHaveLength(1);
      expect(data.statusChanges[0].fromStatus).toBe("paid");
      expect(data.statusChanges[0].toStatus).toBe("draft");
    });

    it("should recalculate totals correctly when reverting", async () => {
      const multiLineRcti = {
        ...mockPaidRcti,
        subtotal: 2000.0,
        gst: 200.0,
        total: 2200.0,
      };

      const multiLines = [
        {
          id: 1,
          rctiId: 1,
          amountExGst: 1000.0,
          gstAmount: 100.0,
          amountIncGst: 1100.0,
        },
        {
          id: 2,
          rctiId: 1,
          amountExGst: 1000.0,
          gstAmount: 100.0,
          amountIncGst: 1100.0,
        },
      ];

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(multiLineRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(multiLines);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback(prisma),
      );
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...multiLineRcti,
        status: "draft",
        subtotal: 2000.0,
        gst: 200.0,
        total: 2200.0,
      });

      const request = createMockRequest("1", {
        reason: "Incorrect amount charged",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      // Verify update was called with correct totals
      expect(prisma.rcti.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 2000.0,
            gst: 200.0,
            total: 2200.0,
          }),
        }),
      );
    });

    it("should handle longer reason text", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback(prisma),
      );
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockPaidRcti,
        status: "draft",
        revertedToDraftReason:
          "Payment was cancelled due to billing dispute. Customer requested adjustment to hours charged on invoice line items.",
      });

      const longReason =
        "Payment was cancelled due to billing dispute. Customer requested adjustment to hours charged on invoice line items.";

      const request = createMockRequest("1", {
        reason: longReason,
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.revertedToDraftReason).toBe(longReason);
    });
  });

  describe("Validation errors", () => {
    it("should reject revert without reason", async () => {
      const request = createMockRequest("1", {
        reason: undefined,
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect([400, 500]).toContain(response.status);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should reject revert with empty reason", async () => {
      const request = createMockRequest("1", {
        reason: "",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect([400, 500]).toContain(response.status);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should reject revert with whitespace-only reason", async () => {
      const request = createMockRequest("1", {
        reason: "    ",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect([400, 500]).toContain(response.status);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should reject revert with reason less than 5 characters", async () => {
      const request = createMockRequest("1", {
        reason: "test",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect([400, 500]).toContain(response.status);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should reject invalid RCTI ID", async () => {
      const request = createMockRequest("invalid", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "invalid" });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid RCTI ID");
    });
  });

  describe("Business logic errors", () => {
    it("should return 404 for non-existent RCTI", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest("999", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "999" });
      const response = await POST(request, { params });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("RCTI not found");
    });

    it("should reject revert for draft RCTI", async () => {
      const draftRcti = {
        ...mockPaidRcti,
        status: "draft",
        paidAt: null,
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(draftRcti);

      const request = createMockRequest("1", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Only paid RCTIs can be reverted to draft");
      expect(removeDeductionsFromRcti).not.toHaveBeenCalled();
    });

    it("should reject revert for finalised RCTI", async () => {
      const finalisedRcti = {
        ...mockPaidRcti,
        status: "finalised",
        paidAt: null,
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(finalisedRcti);

      const request = createMockRequest("1", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Only paid RCTIs can be reverted to draft");
      expect(removeDeductionsFromRcti).not.toHaveBeenCalled();
    });
  });

  describe("Deduction handling", () => {
    it("should remove deductions when reverting", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
        callback(prisma),
      );
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockPaidRcti,
        status: "draft",
      });

      const request = createMockRequest("1", {
        reason: "Deduction applied incorrectly",
      });

      const params = Promise.resolve({ id: "1" });
      await POST(request, { params });

      expect(removeDeductionsFromRcti).toHaveBeenCalledWith({ rctiId: 1 });
    });

    it("should handle deduction removal errors gracefully", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (removeDeductionsFromRcti as jest.Mock).mockRejectedValue(
        new Error("Database connection error"),
      );

      const request = createMockRequest("1", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to revert RCTI to draft");
    });
  });

  describe("Status change tracking", () => {
    it("should create status change record with correct data", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);
      (removeDeductionsFromRcti as jest.Mock).mockResolvedValue(undefined);

      let statusChangeCreated = false;
      let statusChangeReason = "";

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            rctiStatusChange: {
              create: jest.fn().mockImplementation((data) => {
                statusChangeCreated = true;
                statusChangeReason = data.data.reason;
                return Promise.resolve({
                  id: 1,
                  rctiId: data.data.rctiId,
                  fromStatus: data.data.fromStatus,
                  toStatus: data.data.toStatus,
                  reason: data.data.reason,
                  changedBy: data.data.changedBy,
                  changedAt: data.data.changedAt,
                });
              }),
            },
            rcti: {
              update: jest.fn().mockResolvedValue({
                ...mockPaidRcti,
                status: "draft",
                driver: { id: 10, driver: "John Smith", type: "Contractor" },
                lines: mockRctiLines,
                statusChanges: [
                  {
                    id: 1,
                    rctiId: 1,
                    fromStatus: "paid",
                    toStatus: "draft",
                    reason: "Payment disputed",
                    changedBy: "test-user-123",
                    changedAt: new Date("2025-01-26"),
                  },
                ],
              }),
            },
          };
          return callback(tx);
        },
      );

      const request = createMockRequest("1", {
        reason: "Payment disputed",
      });

      const params = Promise.resolve({ id: "1" });
      await POST(request, { params });

      expect(statusChangeCreated).toBe(true);
      expect(statusChangeReason).toBe("Payment disputed");
    });
  });

  describe("Transaction handling", () => {
    it("should rollback if status change creation fails", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Transaction failed"),
      );

      const request = createMockRequest("1", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to revert RCTI to draft");
    });

    it("should rollback if RCTI update fails", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            rctiStatusChange: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            rcti: {
              update: jest.fn().mockRejectedValue(new Error("Update failed")),
            },
          };
          return callback(tx);
        },
      );

      const request = createMockRequest("1", {
        reason: "Valid reason here",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(500);
    });
  });

  describe("Edge cases", () => {
    it("should handle RCTI with no lines", async () => {
      const noLinesRcti = {
        ...mockPaidRcti,
        lines: [],
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(noLinesRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([]);
      (removeDeductionsFromRcti as jest.Mock).mockResolvedValue(undefined);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            rctiStatusChange: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            rcti: {
              update: jest.fn().mockResolvedValue({
                ...noLinesRcti,
                status: "draft",
                subtotal: 0,
                gst: 0,
                total: 0,
                driver: { id: 10, driver: "John Smith", type: "Contractor" },
                lines: [],
                statusChanges: [],
              }),
            },
          };
          return callback(tx);
        },
      );

      const request = createMockRequest("1", {
        reason: "Empty RCTI revert",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.subtotal).toBe(0);
      expect(data.gst).toBe(0);
      expect(data.total).toBe(0);
    });

    it("should handle decimal precision in recalculation", async () => {
      const decimalRcti = {
        ...mockPaidRcti,
        subtotal: 999.99,
        gst: 99.999,
        total: 1099.989,
      };

      const decimalLines = [
        {
          id: 1,
          rctiId: 1,
          amountExGst: 333.33,
          gstAmount: 33.333,
          amountIncGst: 366.663,
        },
        {
          id: 2,
          rctiId: 1,
          amountExGst: 333.33,
          gstAmount: 33.333,
          amountIncGst: 366.663,
        },
        {
          id: 3,
          rctiId: 1,
          amountExGst: 333.33,
          gstAmount: 33.333,
          amountIncGst: 366.663,
        },
      ];

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(decimalRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(decimalLines);
      (removeDeductionsFromRcti as jest.Mock).mockResolvedValue(undefined);

      let updateData: any = null;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            rctiStatusChange: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            rcti: {
              update: jest.fn().mockImplementation((data) => {
                updateData = data;
                return Promise.resolve({
                  ...decimalRcti,
                  status: "draft",
                  driver: { id: 10, driver: "John Smith", type: "Contractor" },
                  lines: decimalLines,
                  statusChanges: [],
                });
              }),
            },
          };
          return callback(tx);
        },
      );

      const request = createMockRequest("1", {
        reason: "Decimal precision test",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      // Verify the calculation used proper summation
      expect(updateData.data.subtotal).toBe(999.99);
      expect(updateData.data.gst).toBe(99.999);
      expect(updateData.data.total).toBe(1099.989);
    });

    it("should trim whitespace from reason", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockRctiLines);
      (removeDeductionsFromRcti as jest.Mock).mockResolvedValue(undefined);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const tx = {
            rctiStatusChange: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
            rcti: {
              update: jest.fn().mockResolvedValue({
                ...mockPaidRcti,
                status: "draft",
                driver: { id: 10, driver: "John Smith", type: "Contractor" },
                lines: mockRctiLines,
                statusChanges: [],
              }),
            },
          };
          return callback(tx);
        },
      );

      const request = createMockRequest("1", {
        reason: "  Valid reason with spaces  ",
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      // Should still be valid after trimming
      expect(response.status).toBe(200);
    });
  });
});

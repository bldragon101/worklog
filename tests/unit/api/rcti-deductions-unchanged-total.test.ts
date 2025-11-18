/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/rcti-deductions/[id]/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rctiDeduction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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

describe("RCTI Deductions PATCH - Unchanged totalAmount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (id: string, body: unknown) => {
    return new NextRequest(`http://localhost:3000/api/rcti-deductions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  describe("With applications already applied", () => {
    it("should allow PATCH with unchanged totalAmount when applications exist", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 150,
        amountRemaining: 850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 150,
            appliedAt: new Date("2025-01-08"),
          },
        ],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        description: "Updated Equipment Rental",
      });

      const request = createMockRequest("1", {
        description: "Updated Equipment Rental",
        totalAmount: 1000, // Same as current
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          description: "Updated Equipment Rental",
          // totalAmount and amountRemaining should NOT be in data since unchanged
        },
        include: expect.any(Object),
      });
    });

    it("should reject PATCH with changed totalAmount when applications exist", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 150,
        amountRemaining: 850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 150,
            appliedAt: new Date("2025-01-08"),
          },
        ],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );

      const request = createMockRequest("1", {
        totalAmount: 1500, // Different from current
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain(
        "Cannot change total amount after deduction has been applied",
      );
      expect(prisma.rctiDeduction.update).not.toHaveBeenCalled();
    });

    it("should allow updating other fields with unchanged totalAmount", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 150,
        amountRemaining: 850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 150,
            appliedAt: new Date("2025-01-08"),
          },
        ],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        description: "New Description",
        amountPerCycle: 200,
      });

      const request = createMockRequest("1", {
        description: "New Description",
        amountPerCycle: 200,
        totalAmount: 1000, // Unchanged
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          description: "New Description",
          amountPerCycle: 200,
          // totalAmount should NOT be updated since it's unchanged
        },
        include: expect.any(Object),
      });
    });

    it("should handle unchanged totalAmount with floating point precision", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1234.56,
        amountPaid: 123.45,
        amountRemaining: 1111.11,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 123.45,
            appliedAt: new Date("2025-01-08"),
          },
        ],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        description: "Updated",
      });

      const request = createMockRequest("1", {
        description: "Updated",
        totalAmount: 1234.56, // Same value
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
    });
  });

  describe("Without applications", () => {
    it("should allow PATCH with changed totalAmount when no applications", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 0,
        amountRemaining: 1000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [], // No applications
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        totalAmount: 1500,
        amountRemaining: 1500,
      });

      const request = createMockRequest("1", {
        totalAmount: 1500, // Different from current
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          totalAmount: 1500,
          amountRemaining: 1500, // Should be recalculated (1500 - 0)
        },
        include: expect.any(Object),
      });
    });

    it("should allow PATCH with unchanged totalAmount when no applications", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 0,
        amountRemaining: 1000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        description: "Updated",
      });

      const request = createMockRequest("1", {
        description: "Updated",
        totalAmount: 1000, // Same as current
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          description: "Updated",
          // totalAmount should NOT be updated since unchanged
        },
        include: expect.any(Object),
      });
    });

    it("should recalculate amountRemaining when totalAmount changes", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 200,
        amountRemaining: 800,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [], // No applications, so change is allowed
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        totalAmount: 1500,
        amountRemaining: 1300, // 1500 - 200
      });

      const request = createMockRequest("1", {
        totalAmount: 1500,
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          totalAmount: 1500,
          amountRemaining: 1300, // Should be recalculated: 1500 - 200
        },
        include: expect.any(Object),
      });
    });
  });

  describe("Edge cases", () => {
    it("should reject zero totalAmount even if unchanged", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 0,
        amountRemaining: 1000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );

      const request = createMockRequest("1", {
        totalAmount: 0,
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Total amount must be greater than 0");
      expect(prisma.rctiDeduction.update).not.toHaveBeenCalled();
    });

    it("should reject negative totalAmount even if unchanged", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 0,
        amountRemaining: 1000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );

      const request = createMockRequest("1", {
        totalAmount: -100,
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Total amount must be greater than 0");
      expect(prisma.rctiDeduction.update).not.toHaveBeenCalled();
    });

    it("should handle totalAmount as string (coerced to number)", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 0,
        amountRemaining: 1000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );
      (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
        ...mockDeduction,
        description: "Updated",
      });

      const request = createMockRequest("1", {
        description: "Updated",
        totalAmount: "1000", // String that equals current total
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
    });

    it("should preserve rate limit headers in error responses", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 1000,
        amountPaid: 150,
        amountRemaining: 850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 150,
            appliedAt: new Date("2025-01-08"),
          },
        ],
      };

      (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
        mockDeduction,
      );

      const request = createMockRequest("1", {
        totalAmount: 1500, // Different - should error
      });

      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(400);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });
});

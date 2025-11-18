/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/[id]/finalize/route";
import { prisma } from "@/lib/prisma";
import { applyDeductionsToRcti } from "@/lib/rcti-deductions";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
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

jest.mock("@/lib/rcti-deductions", () => ({
  applyDeductionsToRcti: jest.fn(),
}));

describe("RCTI Finalize API - Deduction Override Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (id: string, body: unknown) => {
    return new NextRequest(`http://localhost:3000/api/rcti/${id}/finalize`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  const mockRcti = {
    id: 1,
    invoiceNumber: "RCTI-20012025",
    driverId: 10,
    driverName: "John Smith",
    weekEnding: new Date("2025-01-20"),
    status: "draft",
    subtotal: 1000.0,
    gst: 100.0,
    total: 1100.0,
    lines: [
      {
        id: 1,
        jobDate: new Date("2025-01-15"),
        customer: "Test Customer",
        amountExGst: 1000.0,
        gstAmount: 100.0,
        amountIncGst: 1100.0,
      },
    ],
  };

  describe("Valid deduction override values", () => {
    it("should accept numeric values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 1,
        totalDeductionAmount: 150,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        total: 950.0,
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: 150,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(applyDeductionsToRcti).toHaveBeenCalledWith(
        expect.objectContaining({
          amountOverrides: expect.any(Map),
        }),
      );

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(150);
    });

    it("should accept null values for skip", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: null,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(null);
    });

    it("should coerce string numbers to numeric values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 1,
        totalDeductionAmount: 100,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        total: 1000.0,
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: "100",
          2: "50.5",
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(100);
      expect(overridesMap.get(2)).toBe(50.5);
      expect(typeof overridesMap.get(1)).toBe("number");
      expect(typeof overridesMap.get(2)).toBe("number");
    });

    it("should handle zero values correctly", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: 0,
          2: "0",
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(0);
      expect(overridesMap.get(2)).toBe(0);
      expect(typeof overridesMap.get(1)).toBe("number");
    });

    it("should handle negative values correctly", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 1,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: -50,
          2: "-25.5",
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(-50);
      expect(overridesMap.get(2)).toBe(-25.5);
    });

    it("should handle mixed valid values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 2,
        totalDeductionAmount: 150,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: 100,
          2: "50",
          3: null,
          4: 0,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(100);
      expect(overridesMap.get(2)).toBe(50);
      expect(overridesMap.get(3)).toBe(null);
      expect(overridesMap.get(4)).toBe(0);
    });
  });

  describe("Invalid deduction override values", () => {
    it("should reject non-numeric string values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: "abc",
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid deduction override value");
      expect(data.error).toContain("deduction 1");
      expect(applyDeductionsToRcti).not.toHaveBeenCalled();
    });

    it("should reject empty string values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: "",
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid deduction override value");
      expect(applyDeductionsToRcti).not.toHaveBeenCalled();
    });

    it("should handle NaN values (serialized as null)", async () => {
      // NaN cannot be represented in JSON and becomes null
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: NaN,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      // NaN serializes to null in JSON, which is valid (means skip)
      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(null);
    });

    it("should handle Infinity values (serialized as null)", async () => {
      // Infinity cannot be represented in JSON and becomes null
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: Infinity,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      // Infinity serializes to null in JSON, which is valid (means skip)
      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(null);
    });

    it("should reject object values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: { amount: 100 },
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid deduction override value");
      expect(applyDeductionsToRcti).not.toHaveBeenCalled();
    });

    it("should reject array values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: [100],
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid deduction override value");
      expect(applyDeductionsToRcti).not.toHaveBeenCalled();
    });

    it("should reject boolean values", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: true,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid deduction override value");
      expect(applyDeductionsToRcti).not.toHaveBeenCalled();
    });

    it("should fail on first invalid value in mixed batch", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: 100,
          2: "invalid",
          3: 50,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid deduction override value");
      expect(data.error).toContain("deduction 2");
      expect(applyDeductionsToRcti).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined deductionOverrides in body", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {});

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      expect(callArgs.amountOverrides).toBeUndefined();
    });

    it("should handle empty deductionOverrides object", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {},
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      expect(callArgs.amountOverrides).toBeUndefined();
    });

    it("should skip invalid deduction IDs", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 1,
        totalDeductionAmount: 100,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          abc: 100,
          1: 100,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.size).toBe(1);
      expect(overridesMap.has(1)).toBe(true);
      expect(overridesMap.has(NaN)).toBe(false);
    });

    it("should handle very large numbers", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 1,
        totalDeductionAmount: 999999999,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: 999999999,
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(999999999);
    });

    it("should handle decimal precision correctly", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockRcti);
      (applyDeductionsToRcti as jest.Mock).mockResolvedValue({
        applied: 1,
        totalDeductionAmount: 123.456,
        totalReimbursementAmount: 0,
      });
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockRcti,
        status: "finalised",
        driver: { id: 10, driver: "John Smith", type: "Contractor" },
        deductionApplications: [],
      });

      const request = createMockRequest("1", {
        deductionOverrides: {
          1: "123.456",
        },
      });

      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      const callArgs = (applyDeductionsToRcti as jest.Mock).mock.calls[0][0];
      const overridesMap = callArgs.amountOverrides;
      expect(overridesMap.get(1)).toBe(123.456);
    });
  });
});

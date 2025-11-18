/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/rcti-deductions/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rctiDeduction: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "user_123" }),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => () => ({ headers: new Headers() })),
  rateLimitConfigs: { general: {} },
}));

describe("GET /api/rcti-deductions - Cancelled Deduction Filter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should exclude cancelled deductions by default", async () => {
    const mockDeductions = [
      {
        id: 1,
        driverId: 100,
        type: "deduction",
        description: "Active deduction",
        totalAmount: 500,
        status: "active",
        driver: { id: 100, driver: "Test Driver" },
        applications: [],
      },
    ];

    (prisma.rctiDeduction.findMany as jest.Mock).mockResolvedValue(
      mockDeductions,
    );

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions?driverId=100",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 100,
          status: "active",
        }),
      }),
    );
    expect(data).toEqual(mockDeductions);
  });

  it("should return cancelled deductions when explicitly requested", async () => {
    const mockCancelledDeductions = [
      {
        id: 2,
        driverId: 100,
        type: "deduction",
        description: "Cancelled deduction",
        totalAmount: 300,
        status: "cancelled",
        driver: { id: 100, driver: "Test Driver" },
        applications: [],
      },
    ];

    (prisma.rctiDeduction.findMany as jest.Mock).mockResolvedValue(
      mockCancelledDeductions,
    );

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions?driverId=100&status=cancelled",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 100,
          status: "cancelled",
        }),
      }),
    );
    expect(data).toEqual(mockCancelledDeductions);
  });

  it("should return completed deductions when explicitly requested", async () => {
    const mockCompletedDeductions = [
      {
        id: 3,
        driverId: 100,
        type: "deduction",
        description: "Completed deduction",
        totalAmount: 200,
        status: "completed",
        driver: { id: 100, driver: "Test Driver" },
        applications: [],
      },
    ];

    (prisma.rctiDeduction.findMany as jest.Mock).mockResolvedValue(
      mockCompletedDeductions,
    );

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions?driverId=100&status=completed",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 100,
          status: "completed",
        }),
      }),
    );
    expect(data).toEqual(mockCompletedDeductions);
  });

  it("should only return active deductions when no status specified", async () => {
    const mockActiveDeductions = [
      {
        id: 1,
        driverId: 100,
        type: "deduction",
        description: "Active 1",
        totalAmount: 100,
        status: "active",
        driver: { id: 100, driver: "Test Driver" },
        applications: [],
      },
      {
        id: 4,
        driverId: 100,
        type: "reimbursement",
        description: "Active 2",
        totalAmount: 50,
        status: "active",
        driver: { id: 100, driver: "Test Driver" },
        applications: [],
      },
    ];

    (prisma.rctiDeduction.findMany as jest.Mock).mockResolvedValue(
      mockActiveDeductions,
    );

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions?driverId=100",
    );

    await GET(request);

    // Verify that the where clause includes status: "active"
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
        }),
      }),
    );
  });

  it("should filter by type and default to active status", async () => {
    const mockDeductions = [
      {
        id: 5,
        driverId: 100,
        type: "reimbursement",
        description: "Active reimbursement",
        totalAmount: 150,
        status: "active",
        driver: { id: 100, driver: "Test Driver" },
        applications: [],
      },
    ];

    (prisma.rctiDeduction.findMany as jest.Mock).mockResolvedValue(
      mockDeductions,
    );

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions?driverId=100&type=reimbursement",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 100,
          type: "reimbursement",
          status: "active",
        }),
      }),
    );
    expect(data).toEqual(mockDeductions);
  });
});

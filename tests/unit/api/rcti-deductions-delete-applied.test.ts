/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/rcti-deductions/[id]/route";
import { GET } from "@/app/api/rcti-deductions/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rctiDeduction: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: new Headers({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    }),
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

describe("DELETE /api/rcti-deductions/[id] - Applied Deductions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should cancel deduction with applications instead of deleting", async () => {
    const mockDeduction = {
      id: 1,
      driverId: 100,
      type: "deduction",
      description: "Test deduction",
      totalAmount: 500,
      status: "active",
      applications: [
        {
          id: 1,
          deductionId: 1,
          rctiId: 10,
          amount: 100,
          appliedAt: new Date("2025-11-09"),
        },
        {
          id: 2,
          deductionId: 1,
          rctiId: 11,
          amount: 100,
          appliedAt: new Date("2025-11-16"),
        },
      ],
    };

    const mockCancelledDeduction = {
      ...mockDeduction,
      status: "cancelled",
    };

    (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
      mockDeduction,
    );
    (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue(
      mockCancelledDeduction,
    );

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions/1",
      {
        method: "DELETE",
      },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Deduction cancelled");
    expect(data.deduction.status).toBe("cancelled");

    // Verify update was called, not delete
    expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "cancelled" },
    });
    expect(prisma.rctiDeduction.delete).not.toHaveBeenCalled();
  });

  it("should delete deduction without applications completely", async () => {
    const mockDeduction = {
      id: 2,
      driverId: 100,
      type: "deduction",
      description: "Test deduction never applied",
      totalAmount: 300,
      status: "active",
      applications: [],
    };

    (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
      mockDeduction,
    );
    (prisma.rctiDeduction.delete as jest.Mock).mockResolvedValue(mockDeduction);

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions/2",
      {
        method: "DELETE",
      },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "2" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Deduction deleted successfully");

    // Verify delete was called, not update
    expect(prisma.rctiDeduction.delete).toHaveBeenCalledWith({
      where: { id: 2 },
    });
    expect(prisma.rctiDeduction.update).not.toHaveBeenCalled();
  });

  it("should hide cancelled deduction from default GET query", async () => {
    const mockActiveDeductions = [
      {
        id: 3,
        driverId: 100,
        type: "deduction",
        description: "Active deduction",
        totalAmount: 200,
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

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockActiveDeductions);
    expect(data.length).toBe(1);
    expect(data[0].status).toBe("active");

    // Verify the query filtered for active status
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 100,
          status: "active",
        }),
      }),
    );
  });

  it("should show cancelled deduction when explicitly requested", async () => {
    const mockCancelledDeductions = [
      {
        id: 1,
        driverId: 100,
        type: "deduction",
        description: "Cancelled deduction",
        totalAmount: 500,
        status: "cancelled",
        driver: { id: 100, driver: "Test Driver" },
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 10,
            amount: 100,
            appliedAt: new Date("2025-11-09"),
            rcti: {
              id: 10,
              invoiceNumber: "RCTI-001",
              weekEnding: new Date("2025-11-09"),
            },
          },
        ],
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
    expect(data.length).toBe(1);
    expect(data[0].status).toBe("cancelled");
    expect(data[0].description).toBe("Cancelled deduction");
    expect(data[0].totalAmount).toBe(500);
    expect(data[0].applications.length).toBe(1);
    expect(data[0].applications[0].amount).toBe(100);

    // Verify the query explicitly requested cancelled status
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 100,
          status: "cancelled",
        }),
      }),
    );
  });

  it("should handle scenario: create, apply to 2 RCTIs, then delete", async () => {
    // Step 1: Deduction exists and was applied to 2 RCTIs
    const mockDeductionWithApplications = {
      id: 5,
      driverId: 100,
      type: "deduction",
      description: "Phone bill",
      totalAmount: 200,
      amountPaid: 100,
      amountRemaining: 100,
      status: "active",
      applications: [
        {
          id: 10,
          deductionId: 5,
          rctiId: 20,
          amount: 50,
          appliedAt: new Date("2025-11-09"),
        },
        {
          id: 11,
          deductionId: 5,
          rctiId: 21,
          amount: 50,
          appliedAt: new Date("2025-11-16"),
        },
      ],
    };

    // Step 2: User tries to delete the deduction
    (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(
      mockDeductionWithApplications,
    );
    (prisma.rctiDeduction.update as jest.Mock).mockResolvedValue({
      ...mockDeductionWithApplications,
      status: "cancelled",
    });

    const deleteRequest = new NextRequest(
      "http://localhost:3000/api/rcti-deductions/5",
      {
        method: "DELETE",
      },
    );

    const deleteResponse = await DELETE(deleteRequest, {
      params: Promise.resolve({ id: "5" }),
    });
    const deleteData = await deleteResponse.json();

    // Verify deduction was cancelled (not deleted)
    expect(deleteResponse.status).toBe(200);
    expect(deleteData.message).toBe("Deduction cancelled");
    expect(deleteData.deduction.status).toBe("cancelled");
    expect(prisma.rctiDeduction.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: "cancelled" },
    });

    // Step 3: Subsequent GET request should not return the cancelled deduction
    (prisma.rctiDeduction.findMany as jest.Mock).mockResolvedValue([]);

    const getRequest = new NextRequest(
      "http://localhost:3000/api/rcti-deductions?driverId=100",
    );

    const getResponse = await GET(getRequest);
    const getData = await getResponse.json();

    // Verify cancelled deduction is not in the list
    expect(getResponse.status).toBe(200);
    expect(getData).toEqual([]);
    expect(getData.length).toBe(0);

    // Verify query filtered for active status
    expect(prisma.rctiDeduction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "active",
        }),
      }),
    );
  });

  it("should return 404 when trying to delete non-existent deduction", async () => {
    (prisma.rctiDeduction.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3000/api/rcti-deductions/999",
      {
        method: "DELETE",
      },
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Deduction not found");
    expect(prisma.rctiDeduction.delete).not.toHaveBeenCalled();
    expect(prisma.rctiDeduction.update).not.toHaveBeenCalled();
  });
});

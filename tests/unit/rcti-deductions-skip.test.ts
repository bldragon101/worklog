/**
 * Unit tests for RCTI deduction skip functionality
 * Tests the ability to skip deductions for specific RCTIs
 */

import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

describe("RCTI Deductions - Skip Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Skip deduction (amount override = null)", () => {
    it("should create $0 application when deduction is skipped", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 0,
        amountRemaining: 2000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      let createdApplication: {
        deductionId: number;
        rctiId: number;
        amount: number;
      } | null = null;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn().mockResolvedValue({ count: 0 }), // No update when skipped
            },
            rctiDeductionApplication: {
              create: jest.fn((data) => {
                createdApplication = data.data;
                return Promise.resolve({
                  id: 1,
                  ...data.data,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-16"),
        amountOverrides: new Map([[1, null]]), // Skip deduction
      });

      // Should create application with $0
      expect(createdApplication).toBeDefined();
      expect(createdApplication).not.toBeNull();
      expect(createdApplication!.amount).toBe(0);
      expect(createdApplication!.deductionId).toBe(1);
      expect(createdApplication!.rctiId).toBe(100);

      // Should not count in totals
      expect(result.applied).toBe(0);
      expect(result.totalDeductionAmount).toBe(0);
    });

    it("should not update deduction amounts when skipped", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 0,
        amountRemaining: 2000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      let updateManyCalled = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn(() => {
                updateManyCalled = true;
                return Promise.resolve({ count: 0 });
              }),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 1,
                deductionId: 1,
                rctiId: 100,
                amount: 0,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-16"),
        amountOverrides: new Map([[1, null]]),
      });

      // updateMany should not be called for skipped deductions
      expect(updateManyCalled).toBe(false);
    });

    it("should resume normal deductions after skip", async () => {
      // Week 1: Skipped (creates $0 application)
      const mockDeductionWeek1 = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 0,
        amountRemaining: 2000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek1]),
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 1,
                deductionId: 1,
                rctiId: 100,
                amount: 0,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek1 = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-09"),
        amountOverrides: new Map([[1, null]]), // Skip
      });

      expect(resultWeek1.totalDeductionAmount).toBe(0);

      // Week 2: Normal deduction (no override)
      const mockDeductionWeek2 = {
        ...mockDeductionWeek1,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 0,
            appliedAt: new Date("2025-11-09"),
            rcti: {
              weekEnding: new Date("2025-11-09"),
            },
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek2]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 2,
                deductionId: 1,
                rctiId: 101,
                amount: 150,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek2 = await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-11-16"),
        // No override - should apply normally
      });

      expect(resultWeek2.totalDeductionAmount).toBe(150);
      expect(resultWeek2.applied).toBe(1);
    });
  });

  describe("Custom amount override", () => {
    it("should apply custom amount when overridden", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 0,
        amountRemaining: 2000,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      let createdApplication: {
        deductionId: number;
        rctiId: number;
        amount: number;
      } | null = null;
      let updatedAmount: {
        amountPaid: number;
        amountRemaining: number;
      } | null = null;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn((args) => {
                updatedAmount = args.data;
                return Promise.resolve({ count: 1 });
              }),
            },
            rctiDeductionApplication: {
              create: jest.fn((data) => {
                createdApplication = data.data;
                return Promise.resolve({
                  id: 1,
                  ...data.data,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-16"),
        amountOverrides: new Map([[1, 100]]), // $100 instead of $150
      });

      expect(createdApplication).not.toBeNull();
      expect(updatedAmount).not.toBeNull();
      expect(createdApplication!.amount).toBe(100);
      expect(updatedAmount!.amountPaid).toBe(100);
      expect(updatedAmount!.amountRemaining).toBe(1900);
      expect(result.totalDeductionAmount).toBe(100);
      expect(result.applied).toBe(1);
    });

    it("should not exceed remaining amount even with override", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 1950,
        amountRemaining: 50,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            appliedAt: new Date("2025-11-09"),
            rcti: { weekEnding: new Date("2025-11-09") },
          },
        ],
      };

      let createdAmount: number = 0;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn((data) => {
                createdAmount = data.data.amount;
                return Promise.resolve({
                  id: 1,
                  ...data.data,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-16"),
        amountOverrides: new Map([[1, 150]]), // Try to override to $150
      });

      // Should cap at remaining amount ($50)
      expect(createdAmount).toBe(50);
    });
  });

  describe("Multiple deductions with mixed overrides", () => {
    it("should handle skip, override, and normal deductions together", async () => {
      const mockDeductions = [
        {
          id: 1,
          driverId: 10,
          type: "deduction",
          description: "Equipment Rental",
          totalAmount: 2000,
          amountPaid: 0,
          amountRemaining: 2000,
          amountPerCycle: 150,
          frequency: "weekly",
          startDate: new Date("2025-11-03"),
          status: "active",
          completedAt: null,
          applications: [],
        },
        {
          id: 2,
          driverId: 10,
          type: "deduction",
          description: "Advance Payment",
          totalAmount: 1700,
          amountPaid: 0,
          amountRemaining: 1700,
          amountPerCycle: 150,
          frequency: "weekly",
          startDate: new Date("2025-11-03"),
          status: "active",
          completedAt: null,
          applications: [],
        },
        {
          id: 3,
          driverId: 10,
          type: "reimbursement",
          description: "Fuel Allowance",
          totalAmount: 500,
          amountPaid: 0,
          amountRemaining: 500,
          amountPerCycle: 100,
          frequency: "weekly",
          startDate: new Date("2025-11-03"),
          status: "active",
          completedAt: null,
          applications: [],
        },
      ];

      const applications: Array<{
        deductionId: number;
        rctiId: number;
        amount: number;
      }> = [];

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue(mockDeductions),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn((data) => {
                applications.push(data.data);
                return Promise.resolve({
                  id: applications.length,
                  ...data.data,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-16"),
        amountOverrides: new Map([
          [1, null], // Skip deduction 1
          [2, 100], // Override deduction 2 to $100
          // Deduction 3 (reimbursement) uses default $100
        ]),
      });

      expect(applications.length).toBe(3);

      // Deduction 1: Skipped
      expect(applications[0].deductionId).toBe(1);
      expect(applications[0].amount).toBe(0);

      // Deduction 2: Overridden to $100
      expect(applications[1].deductionId).toBe(2);
      expect(applications[1].amount).toBe(100);

      // Deduction 3: Normal $100
      expect(applications[2].deductionId).toBe(3);
      expect(applications[2].amount).toBe(100);

      // Totals
      expect(result.applied).toBe(2); // Only non-zero applications count
      expect(result.totalDeductionAmount).toBe(100); // Only deduction 2
      expect(result.totalReimbursementAmount).toBe(100); // Deduction 3
    });
  });
});

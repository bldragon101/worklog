/**
 * Unit tests for "once" frequency deductions with skip functionality
 * Verifies that skipping a "once" deduction does not permanently block it
 */

import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

describe("RCTI Deductions - Once Frequency with Skip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Skipping a 'once' deduction", () => {
    it("should allow applying a 'once' deduction after it was previously skipped", async () => {
      // Week 1: Skip the one-time deduction
      const mockDeductionWeek1 = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "One-time Equipment Purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 500,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [], // No applications yet
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
        weekEnding: new Date("2025-01-06"),
        amountOverrides: new Map([[1, null]]), // Skip
      });

      expect(resultWeek1.applied).toBe(0);
      expect(resultWeek1.totalDeductionAmount).toBe(0);

      // Week 2: Try to apply the one-time deduction (should be allowed since previous was skipped)
      const mockDeductionWeek2 = {
        ...mockDeductionWeek1,
        applications: [
          {
            id: 1,
            amount: 0, // Previous application was $0 (skipped)
            rcti: {
              weekEnding: new Date("2025-01-06"),
            },
          },
        ],
      };

      let applicationCreatedWeek2 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek2]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreatedWeek2 = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 101,
                  amount: 500,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek2 = await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-13"),
        // No override - should apply normally
      });

      expect(applicationCreatedWeek2).toBe(true);
      expect(resultWeek2.applied).toBe(1);
      expect(resultWeek2.totalDeductionAmount).toBe(500);
    });

    it("should prevent applying a 'once' deduction after it was applied with non-zero amount", async () => {
      // Week 1: Apply the one-time deduction
      const mockDeductionWeek1 = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "One-time Equipment Purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 500,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek1]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 1,
                deductionId: 1,
                rctiId: 100,
                amount: 500,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek1 = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-01-06"),
      });

      expect(resultWeek1.applied).toBe(1);
      expect(resultWeek1.totalDeductionAmount).toBe(500);

      // Week 2: Try to apply again (should be blocked because status is completed)
      let applicationCreatedWeek2 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([]), // Empty because status is 'completed'
              updateMany: jest.fn(),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreatedWeek2 = true;
                return Promise.resolve({});
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek2 = await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-13"),
      });

      expect(applicationCreatedWeek2).toBe(false);
      expect(resultWeek2.applied).toBe(0);
    });

    it("should handle multiple skips of a 'once' deduction", async () => {
      // Skip in Week 1
      const mockDeductionWeek1 = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "One-time Equipment Purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 500,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek1]),
              updateMany: jest.fn(),
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
        weekEnding: new Date("2025-01-06"),
        amountOverrides: new Map([[1, null]]), // Skip
      });

      // Skip in Week 2 (should still be allowed)
      const mockDeductionWeek2 = {
        ...mockDeductionWeek1,
        applications: [
          {
            id: 1,
            amount: 0,
            rcti: {
              weekEnding: new Date("2025-01-06"),
            },
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek2]),
              updateMany: jest.fn(),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 2,
                deductionId: 1,
                rctiId: 101,
                amount: 0,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-13"),
        amountOverrides: new Map([[1, null]]), // Skip again
      });

      // Week 3: Apply normally (should still work)
      const mockDeductionWeek3 = {
        ...mockDeductionWeek1,
        applications: [
          {
            id: 2,
            amount: 0, // Most recent skip
            rcti: {
              weekEnding: new Date("2025-01-13"),
            },
          },
        ],
      };

      let applicationCreatedWeek3 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek3]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreatedWeek3 = true;
                return Promise.resolve({
                  id: 3,
                  deductionId: 1,
                  rctiId: 102,
                  amount: 500,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek3 = await applyDeductionsToRcti({
        rctiId: 102,
        driverId: 10,
        weekEnding: new Date("2025-01-20"),
      });

      expect(applicationCreatedWeek3).toBe(true);
      expect(resultWeek3.totalDeductionAmount).toBe(500);
    });

    it("should handle partial amount as completion for 'once' deduction", async () => {
      // Week 1: Apply partial amount (e.g., $300 out of $500)
      const mockDeductionWeek1 = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "One-time Equipment Purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 500,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek1]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 1,
                deductionId: 1,
                rctiId: 100,
                amount: 300,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek1 = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-01-06"),
        amountOverrides: new Map([[1, 300]]), // Partial amount
      });

      expect(resultWeek1.applied).toBe(1);
      expect(resultWeek1.totalDeductionAmount).toBe(300);

      // Week 2: Should be blocked (already applied with non-zero amount)
      const mockDeductionWeek2 = {
        ...mockDeductionWeek1,
        amountPaid: 300,
        amountRemaining: 200,
        applications: [
          {
            id: 1,
            amount: 300, // Non-zero amount
            rcti: {
              weekEnding: new Date("2025-01-06"),
            },
          },
        ],
      };

      let applicationCreatedWeek2 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeductionWeek2]),
              updateMany: jest.fn(),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreatedWeek2 = true;
                return Promise.resolve({});
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek2 = await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-13"),
      });

      expect(applicationCreatedWeek2).toBe(false);
      expect(resultWeek2.applied).toBe(0);
    });
  });

  describe("'once' deduction with reimbursement type", () => {
    it("should allow one-time reimbursement after skip", async () => {
      // Skip reimbursement in Week 1
      const mockReimbursementWeek1 = {
        id: 1,
        driverId: 10,
        type: "reimbursement",
        description: "One-time Fuel Reimbursement",
        totalAmount: 200,
        amountPaid: 0,
        amountRemaining: 200,
        amountPerCycle: 200,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockReimbursementWeek1]),
              updateMany: jest.fn(),
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
        weekEnding: new Date("2025-01-06"),
        amountOverrides: new Map([[1, null]]), // Skip
      });

      // Week 2: Apply reimbursement
      const mockReimbursementWeek2 = {
        ...mockReimbursementWeek1,
        applications: [
          {
            id: 1,
            amount: 0,
            rcti: {
              weekEnding: new Date("2025-01-06"),
            },
          },
        ],
      };

      let applicationCreatedWeek2 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockReimbursementWeek2]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreatedWeek2 = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 101,
                  amount: 200,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const resultWeek2 = await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-13"),
      });

      expect(applicationCreatedWeek2).toBe(true);
      expect(resultWeek2.totalReimbursementAmount).toBe(200);
    });
  });

  describe("Edge cases", () => {
    it("should handle 'once' deduction with no applications array", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "One-time Equipment Purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 500,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      let applicationCreated = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreated = true;
                return Promise.resolve({
                  id: 1,
                  deductionId: 1,
                  rctiId: 100,
                  amount: 500,
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
        weekEnding: new Date("2025-01-06"),
      });

      expect(applicationCreated).toBe(true);
      expect(result.totalDeductionAmount).toBe(500);
    });

    it("should treat very small non-zero amounts as applied", async () => {
      // Apply $0.01 (very small amount, but not zero)
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "One-time Equipment Purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 500,
        frequency: "once",
        startDate: new Date("2025-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            amount: 0.01, // Very small but non-zero
            rcti: {
              weekEnding: new Date("2025-01-06"),
            },
          },
        ],
      };

      let applicationCreated = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn(),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreated = true;
                return Promise.resolve({});
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-13"),
      });

      // Should not create application (0.01 counts as applied)
      expect(applicationCreated).toBe(false);
      expect(result.applied).toBe(0);
    });
  });
});

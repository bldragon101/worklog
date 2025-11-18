/**
 * @jest-environment node
 */
import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { prisma } from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    rctiDeduction: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    rctiDeductionApplication: {
      create: jest.fn(),
    },
  },
}));

describe("RCTI Deductions Concurrency Safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("applyDeductionsToRcti - Optimistic Locking", () => {
    it("should prevent double-application under concurrent calls using optimistic locking", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      // Mock transaction to execute the callback immediately
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }), // Success
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 1,
                deductionId: 1,
                rctiId: 100,
                amount: 100,
                appliedAt: new Date(),
              }),
            },
          });
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Verify deduction was applied successfully
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.applied).toBe(1);
      expect(result.totalDeductionAmount).toBe(100);
    });

    it("should skip deduction when optimistic lock fails (concurrent update detected)", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      // Mock transaction where updateMany returns count: 0 (optimistic lock failed)
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn().mockResolvedValue({ count: 0 }), // Concurrent update detected
            },
            rctiDeductionApplication: {
              create: jest.fn(),
            },
          });
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Should skip the deduction (applied = 0)
      expect(result.applied).toBe(0);
      expect(result.totalDeductionAmount).toBe(0);
    });

    it("should use amountRemaining in WHERE clause for optimistic lock", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 100,
        amountRemaining: 400,
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [
          {
            appliedAt: new Date("2024-01-01"),
            rcti: {
              weekEnding: new Date("2024-01-07"),
            },
          },
        ],
      };

      let updateManyCallArgs: unknown = null;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn((args) => {
                updateManyCallArgs = args;
                return Promise.resolve({ count: 1 });
              }),
            },
            rctiDeductionApplication: {
              create: jest.fn().mockResolvedValue({
                id: 2,
                deductionId: 1,
                rctiId: 100,
                amount: 100,
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-14"),
      });

      // Verify optimistic lock includes amountRemaining in WHERE
      expect(updateManyCallArgs).toBeDefined();
      expect(updateManyCallArgs).not.toBeNull();
      expect(
        (updateManyCallArgs as { where: Record<string, unknown> }).where,
      ).toMatchObject({
        id: 1,
        amountRemaining: 400, // Original value used for optimistic lock
        status: "active",
      });
    });

    it("should not create application when optimistic lock fails", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      const mockCreate = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: jest.fn().mockResolvedValue({ count: 0 }), // Lock failed
            },
            rctiDeductionApplication: {
              create: mockCreate,
            },
          });
        },
      );

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Application should NOT be created when lock fails
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should apply multiple deductions independently with optimistic locks", async () => {
      const mockDeductions = [
        {
          id: 1,
          driverId: 10,
          type: "deduction",
          description: "Tool purchase",
          totalAmount: 500,
          amountPaid: 0,
          amountRemaining: 500,
          amountPerCycle: 100,
          frequency: "weekly",
          startDate: new Date("2024-01-01"),
          status: "active",
          completedAt: null,
          applications: [],
        },
        {
          id: 2,
          driverId: 10,
          type: "reimbursement",
          description: "Fuel reimbursement",
          totalAmount: 200,
          amountPaid: 0,
          amountRemaining: 200,
          amountPerCycle: 50,
          frequency: "weekly",
          startDate: new Date("2024-01-01"),
          status: "active",
          completedAt: null,
          applications: [],
        },
      ];

      const mockUpdateMany = jest
        .fn()
        .mockResolvedValueOnce({ count: 1 }) // First deduction succeeds
        .mockResolvedValueOnce({ count: 0 }); // Second deduction fails (concurrent update)

      const mockCreate = jest.fn().mockResolvedValue({
        id: 1,
        deductionId: 1,
        rctiId: 100,
        amount: 100,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue(mockDeductions),
              updateMany: mockUpdateMany,
            },
            rctiDeductionApplication: {
              create: mockCreate,
            },
          });
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Only first deduction applied
      expect(result.applied).toBe(1);
      expect(result.totalDeductionAmount).toBe(100);
      expect(result.totalReimbursementAmount).toBe(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Transaction Isolation", () => {
    it("should fetch deductions within the transaction", async () => {
      const mockFindMany = jest.fn().mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: mockFindMany,
              updateMany: jest.fn(),
            },
            rctiDeductionApplication: {
              create: jest.fn(),
            },
          });
        },
      );

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Verify findMany was called within transaction
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          driverId: 10,
          status: "active",
          startDate: {
            lte: expect.any(Date),
          },
        },
        include: {
          applications: {
            include: {
              rcti: {
                select: {
                  weekEnding: true,
                },
              },
            },
            orderBy: {
              appliedAt: "desc",
            },
            take: 1,
          },
        },
      });
    });

    it("should use transactional client for all operations", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 0,
        amountRemaining: 500,
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      const txMock = {
        rctiDeduction: {
          findMany: jest.fn().mockResolvedValue([mockDeduction]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        rctiDeductionApplication: {
          create: jest.fn().mockResolvedValue({
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 100,
          }),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback(txMock);
        },
      );

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Verify all operations used the transaction client
      expect(txMock.rctiDeduction.findMany).toHaveBeenCalled();
      expect(txMock.rctiDeduction.updateMany).toHaveBeenCalled();
      expect(txMock.rctiDeductionApplication.create).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should skip deduction when amountToApply is zero", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 500,
        amountRemaining: 0, // Nothing left to apply
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      const mockUpdateMany = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: mockUpdateMany,
            },
            rctiDeductionApplication: {
              create: jest.fn(),
            },
          });
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Should skip because amountToApply <= 0
      expect(result.applied).toBe(0);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("should skip deduction when amountToApply is negative", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Tool purchase",
        totalAmount: 500,
        amountPaid: 500,
        amountRemaining: -10, // Negative (shouldn't happen but guard against it)
        amountPerCycle: 100,
        frequency: "weekly",
        startDate: new Date("2024-01-01"),
        status: "active",
        completedAt: null,
        applications: [],
      };

      const mockUpdateMany = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
              updateMany: mockUpdateMany,
            },
            rctiDeductionApplication: {
              create: jest.fn(),
            },
          });
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      // Should skip because amountToApply <= 0
      expect(result.applied).toBe(0);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("should handle empty deductions list gracefully", async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([]), // No deductions
              updateMany: jest.fn(),
            },
            rctiDeductionApplication: {
              create: jest.fn(),
            },
          });
        },
      );

      const result = await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2024-01-07"),
      });

      expect(result).toEqual({
        applied: 0,
        totalDeductionAmount: 0,
        totalReimbursementAmount: 0,
      });
    });
  });
});

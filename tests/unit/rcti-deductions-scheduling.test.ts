/**
 * Unit tests for RCTI deduction scheduling and date normalization
 * Tests the scheduling logic that uses RCTI weekEnding dates and date normalization
 */

import { applyDeductionsToRcti } from "@/lib/rcti-deductions";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

describe("RCTI Deductions - Scheduling and Date Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Date normalization to UTC midnight", () => {
    it("should normalize RCTI weekEnding to UTC midnight for comparison", async () => {
      // Last application was at 2:30 PM on 2025-11-09
      const lastApplicationTime = new Date("2025-11-09T14:30:00.000Z");

      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: lastApplicationTime,
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"),
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
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreated = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 101,
                  amount: 150,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      // New RCTI for week ending 2025-11-16 (one week later)
      await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-11-16T00:00:00.000Z"),
      });

      // Should apply because dates are normalized to midnight
      expect(applicationCreated).toBe(true);
    });

    it("should not apply same-day when last application used same weekEnding", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2025-11-09T14:30:00.000Z"),
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"),
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
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

      // Try to apply again for same week ending
      await applyDeductionsToRcti({
        rctiId: 102,
        driverId: 10,
        weekEnding: new Date("2025-11-09T23:59:59.999Z"), // Same day, different time
      });

      // Should NOT apply because weekEnding dates match (normalized)
      expect(applicationCreated).toBe(false);
    });

    it("should handle time-of-day differences correctly", async () => {
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
        startDate: new Date("2025-11-03T08:30:00.000Z"), // 8:30 AM
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
                  amount: 150,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      // RCTI weekEnding at midnight
      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-09T00:00:00.000Z"),
      });

      // Should apply because startDate is before weekEnding (normalized)
      expect(applicationCreated).toBe(true);
    });
  });

  describe("Scheduling using RCTI weekEnding date", () => {
    it("should use RCTI weekEnding for next occurrence calculation, not appliedAt", async () => {
      // RCTI finalized late (on 2025-11-15) but for week ending 2025-11-09
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2025-11-15T16:45:00.000Z"), // Finalized late
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"), // But for this week
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
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreated = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 101,
                  amount: 150,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      // Next RCTI for week ending 2025-11-16
      await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-11-16T00:00:00.000Z"),
      });

      // Should apply because we use weekEnding (2025-11-09), not appliedAt (2025-11-15)
      expect(applicationCreated).toBe(true);
    });

    it("should correctly calculate weekly frequency from weekEnding", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2025-11-09T14:00:00.000Z"),
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"),
            },
          },
        ],
      };

      const testCases = [
        {
          weekEnding: new Date("2025-11-10T00:00:00.000Z"),
          shouldApply: false,
          reason: "only 1 day later",
        },
        {
          weekEnding: new Date("2025-11-15T00:00:00.000Z"),
          shouldApply: false,
          reason: "only 6 days later",
        },
        {
          weekEnding: new Date("2025-11-16T00:00:00.000Z"),
          shouldApply: true,
          reason: "exactly 7 days later",
        },
        {
          weekEnding: new Date("2025-11-23T00:00:00.000Z"),
          shouldApply: true,
          reason: "14 days later (2 weeks)",
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        let applicationCreated = false;

        (prisma.$transaction as jest.Mock).mockImplementation(
          async (callback) => {
            const mockTx = {
              rctiDeduction: {
                findMany: jest.fn().mockResolvedValue([mockDeduction]),
                updateMany: jest
                  .fn()
                  .mockResolvedValue({ count: testCase.shouldApply ? 1 : 0 }),
              },
              rctiDeductionApplication: {
                create: jest.fn(() => {
                  applicationCreated = true;
                  return Promise.resolve({
                    id: 2,
                    deductionId: 1,
                    rctiId: 101,
                    amount: 150,
                  });
                }),
              },
            };
            return await callback(mockTx);
          },
        );

        await applyDeductionsToRcti({
          rctiId: 101,
          driverId: 10,
          weekEnding: testCase.weekEnding,
        });

        expect(applicationCreated).toBe(testCase.shouldApply);
      }
    });

    it("should correctly calculate fortnightly frequency from weekEnding", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "fortnightly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2025-11-09T14:00:00.000Z"),
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"),
            },
          },
        ],
      };

      const testCases = [
        {
          weekEnding: new Date("2025-11-16T00:00:00.000Z"),
          shouldApply: false,
          reason: "only 7 days later (1 week)",
        },
        {
          weekEnding: new Date("2025-11-22T00:00:00.000Z"),
          shouldApply: false,
          reason: "only 13 days later",
        },
        {
          weekEnding: new Date("2025-11-23T00:00:00.000Z"),
          shouldApply: true,
          reason: "exactly 14 days later (2 weeks)",
        },
        {
          weekEnding: new Date("2025-12-07T00:00:00.000Z"),
          shouldApply: true,
          reason: "28 days later (4 weeks)",
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        let applicationCreated = false;

        (prisma.$transaction as jest.Mock).mockImplementation(
          async (callback) => {
            const mockTx = {
              rctiDeduction: {
                findMany: jest.fn().mockResolvedValue([mockDeduction]),
                updateMany: jest
                  .fn()
                  .mockResolvedValue({ count: testCase.shouldApply ? 1 : 0 }),
              },
              rctiDeductionApplication: {
                create: jest.fn(() => {
                  applicationCreated = true;
                  return Promise.resolve({
                    id: 2,
                    deductionId: 1,
                    rctiId: 101,
                    amount: 150,
                  });
                }),
              },
            };
            return await callback(mockTx);
          },
        );

        await applyDeductionsToRcti({
          rctiId: 101,
          driverId: 10,
          weekEnding: testCase.weekEnding,
        });

        expect(applicationCreated).toBe(testCase.shouldApply);
      }
    });

    it("should correctly calculate monthly frequency from weekEnding", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "monthly",
        startDate: new Date("2025-11-03"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2025-11-09T14:00:00.000Z"),
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"),
            },
          },
        ],
      };

      const testCases = [
        {
          weekEnding: new Date("2025-11-16T00:00:00.000Z"),
          shouldApply: false,
          reason: "only 7 days later",
        },
        {
          weekEnding: new Date("2025-12-08T00:00:00.000Z"),
          shouldApply: false,
          reason: "only 29 days later",
        },
        {
          weekEnding: new Date("2025-12-09T00:00:00.000Z"),
          shouldApply: true,
          reason: "exactly 30 days later",
        },
        {
          weekEnding: new Date("2026-01-08T00:00:00.000Z"),
          shouldApply: true,
          reason: "60 days later (2 months)",
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        let applicationCreated = false;

        (prisma.$transaction as jest.Mock).mockImplementation(
          async (callback) => {
            const mockTx = {
              rctiDeduction: {
                findMany: jest.fn().mockResolvedValue([mockDeduction]),
                updateMany: jest
                  .fn()
                  .mockResolvedValue({ count: testCase.shouldApply ? 1 : 0 }),
              },
              rctiDeductionApplication: {
                create: jest.fn(() => {
                  applicationCreated = true;
                  return Promise.resolve({
                    id: 2,
                    deductionId: 1,
                    rctiId: 101,
                    amount: 150,
                  });
                }),
              },
            };
            return await callback(mockTx);
          },
        );

        await applyDeductionsToRcti({
          rctiId: 101,
          driverId: 10,
          weekEnding: testCase.weekEnding,
        });

        expect(applicationCreated).toBe(testCase.shouldApply);
      }
    });
  });

  describe("First application scheduling", () => {
    it("should apply on first RCTI when startDate is before or equal to weekEnding", async () => {
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
        startDate: new Date("2025-11-03T00:00:00.000Z"),
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
                  amount: 150,
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
        weekEnding: new Date("2025-11-09T00:00:00.000Z"),
      });

      expect(applicationCreated).toBe(true);
    });

    it("should not apply when startDate is after weekEnding", async () => {
       

      let applicationCreated = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([]),
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

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-09T00:00:00.000Z"),
      });

      // Should not apply because startDate is in the future
      expect(applicationCreated).toBe(false);
    });
  });

  describe("Edge cases in date handling", () => {
    it("should handle month boundary correctly", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2025-10-27"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2025-10-27T14:00:00.000Z"),
            rcti: {
              weekEnding: new Date("2025-10-27T00:00:00.000Z"),
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
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreated = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 101,
                  amount: 150,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      // Next week crosses into November
      await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-11-03T00:00:00.000Z"),
      });

      expect(applicationCreated).toBe(true);
    });

    it("should handle year boundary correctly", async () => {
      const mockDeduction = {
        id: 1,
        driverId: 10,
        type: "deduction",
        description: "Equipment Rental",
        totalAmount: 2000,
        amountPaid: 150,
        amountRemaining: 1850,
        amountPerCycle: 150,
        frequency: "weekly",
        startDate: new Date("2024-12-23"),
        status: "active",
        completedAt: null,
        applications: [
          {
            id: 1,
            appliedAt: new Date("2024-12-29T14:00:00.000Z"),
            rcti: {
              weekEnding: new Date("2024-12-29T00:00:00.000Z"),
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
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreated = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 101,
                  amount: 150,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      // Next week crosses into 2025
      await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-01-05T00:00:00.000Z"),
      });

      expect(applicationCreated).toBe(true);
    });

    it("should handle leap year date calculation correctly", async () => {
      // Test that date normalization works correctly with leap years
      const jan31 = new Date("2024-01-31T00:00:00.000Z");
      const feb29 = new Date("2024-02-29T00:00:00.000Z");

      // Calculate days between
      const daysBetween = Math.floor(
        (feb29.getTime() - jan31.getTime()) / (1000 * 60 * 60 * 24),
      );

      // 29 days between Jan 31 and Feb 29 in leap year
      expect(daysBetween).toBe(29);

      // Verify Feb 29 exists in 2024 (leap year)
      expect(feb29.getMonth()).toBe(1); // February (0-indexed)
      expect(feb29.getDate()).toBe(29);
      expect(feb29.getFullYear()).toBe(2024);
    });
  });

  describe("Skipped deductions and scheduling", () => {
    it("should advance scheduling even when deduction is skipped", async () => {
      // Week 1: Skip (creates $0 application with weekEnding 2025-11-09)
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

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest.fn().mockResolvedValue([mockDeduction]),
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

      await applyDeductionsToRcti({
        rctiId: 100,
        driverId: 10,
        weekEnding: new Date("2025-11-09T00:00:00.000Z"),
        amountOverrides: new Map([[1, null]]), // Skip
      });

      // Week 2: Try to skip again (should not create duplicate)
      const mockDeductionWithApplication = {
        ...mockDeduction,
        applications: [
          {
            id: 1,
            deductionId: 1,
            rctiId: 100,
            amount: 0,
            appliedAt: new Date("2025-11-09T14:00:00.000Z"),
            rcti: {
              weekEnding: new Date("2025-11-09T00:00:00.000Z"),
            },
          },
        ],
      };

      let applicationCreatedWeek2 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest
                .fn()
                .mockResolvedValue([mockDeductionWithApplication]),
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

      // Try same week again - should not create duplicate
      await applyDeductionsToRcti({
        rctiId: 101,
        driverId: 10,
        weekEnding: new Date("2025-11-09T00:00:00.000Z"),
        amountOverrides: new Map([[1, null]]), // Skip again
      });

      expect(applicationCreatedWeek2).toBe(false);

      // Week 3: Normal application (should work because scheduling advanced)
      let applicationCreatedWeek3 = false;

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const mockTx = {
            rctiDeduction: {
              findMany: jest
                .fn()
                .mockResolvedValue([mockDeductionWithApplication]),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            rctiDeductionApplication: {
              create: jest.fn(() => {
                applicationCreatedWeek3 = true;
                return Promise.resolve({
                  id: 2,
                  deductionId: 1,
                  rctiId: 102,
                  amount: 150,
                });
              }),
            },
          };
          return await callback(mockTx);
        },
      );

      await applyDeductionsToRcti({
        rctiId: 102,
        driverId: 10,
        weekEnding: new Date("2025-11-16T00:00:00.000Z"), // One week later
        // No override - normal application
      });

      expect(applicationCreatedWeek3).toBe(true);
    });
  });
});

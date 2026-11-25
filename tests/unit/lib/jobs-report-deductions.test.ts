/**
 * @vitest-environment node
 */
import {
  applyDeductionsToJobsReport,
  applyDeductionsToRcti,
  getPendingDeductionsForDriver,
  removeDeductionsFromJobsReport,
} from "@/lib/rcti-deductions";
import { parseDeductionOverrides } from "@/lib/utils/deduction-overrides";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  deductionFindMany: vi.fn(),
  deductionUpdateMany: vi.fn(),
  deductionUpdate: vi.fn(),
  rctiApplicationCreate: vi.fn(),
  reportApplicationCreate: vi.fn(),
  reportApplicationFindMany: vi.fn(),
  reportApplicationDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    rctiDeduction: {
      findMany: mocks.deductionFindMany,
      updateMany: mocks.deductionUpdateMany,
      update: mocks.deductionUpdate,
    },
    rctiDeductionApplication: { create: mocks.rctiApplicationCreate },
    jobsReportDeductionApplication: {
      create: mocks.reportApplicationCreate,
      findMany: mocks.reportApplicationFindMany,
      delete: mocks.reportApplicationDelete,
    },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(client),
  };
  return { prisma: client };
});

const tx = prisma as unknown as Prisma.TransactionClient;

function weeklyDeduction({
  overrides = {},
}: {
  overrides?: Record<string, unknown>;
} = {}) {
  return {
    id: 1,
    driverId: 10,
    type: "deduction",
    description: "Uniform",
    totalAmount: 300,
    amountPaid: 0,
    amountRemaining: 300,
    amountPerCycle: 50,
    frequency: "weekly",
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    status: "active",
    completedAt: null,
    applications: [],
    jobsReportApplications: [],
    ...overrides,
  };
}

const weekEnding = new Date("2026-11-22T00:00:00.000Z");
const weekBefore = new Date("2026-11-15T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deductionUpdateMany.mockResolvedValue({ count: 1 });
});

describe("applyDeductionsToJobsReport", () => {
  it("applies a due deduction to the jobs report and updates the balance", async () => {
    mocks.deductionFindMany.mockResolvedValue([weeklyDeduction()]);

    const result = await applyDeductionsToJobsReport({
      reportId: 8,
      driverId: 10,
      weekEnding,
      tx,
    });

    expect(result.applied).toBe(1);
    expect(mocks.deductionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountPaid: 50, amountRemaining: 250 }),
      }),
    );
    expect(mocks.reportApplicationCreate).toHaveBeenCalledWith({
      data: { deductionId: 1, reportId: 8, amount: 50 },
    });
    expect(mocks.rctiApplicationCreate).not.toHaveBeenCalled();
  });

  it("records a skipped deduction as a $0 application without touching the balance", async () => {
    mocks.deductionFindMany.mockResolvedValue([weeklyDeduction()]);

    await applyDeductionsToJobsReport({
      reportId: 8,
      driverId: 10,
      weekEnding,
      amountOverrides: new Map([[1, null]]),
      tx,
    });

    expect(mocks.deductionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.reportApplicationCreate).toHaveBeenCalledWith({
      data: { deductionId: 1, reportId: 8, amount: 0 },
    });
  });

  it("does not apply a cycle already applied to an RCTI for the same week", async () => {
    mocks.deductionFindMany.mockResolvedValue([
      weeklyDeduction({
        overrides: {
          applications: [
            {
              amount: 50,
              appliedAt: new Date("2026-11-23T01:00:00.000Z"),
              rcti: { weekEnding },
            },
          ],
        },
      }),
    ]);

    const result = await applyDeductionsToJobsReport({
      reportId: 8,
      driverId: 10,
      weekEnding,
      tx,
    });

    expect(result.applied).toBe(0);
    expect(mocks.reportApplicationCreate).not.toHaveBeenCalled();
  });

  it("applies the next cycle after one applied to an RCTI the week before", async () => {
    mocks.deductionFindMany.mockResolvedValue([
      weeklyDeduction({
        overrides: {
          applications: [
            {
              amount: 50,
              appliedAt: new Date("2026-11-16T01:00:00.000Z"),
              rcti: { weekEnding: weekBefore },
            },
          ],
        },
      }),
    ]);

    const result = await applyDeductionsToJobsReport({
      reportId: 8,
      driverId: 10,
      weekEnding,
      tx,
    });

    expect(result.applied).toBe(1);
  });
});

describe("applyDeductionsToRcti", () => {
  it("does not apply a cycle already applied to a jobs report for the same week", async () => {
    mocks.deductionFindMany.mockResolvedValue([
      weeklyDeduction({
        overrides: {
          jobsReportApplications: [
            {
              amount: 50,
              appliedAt: new Date("2026-11-23T01:00:00.000Z"),
              report: { weekEnding },
            },
          ],
        },
      }),
    ]);

    const result = await applyDeductionsToRcti({
      rctiId: 4,
      driverId: 10,
      weekEnding,
      tx,
    });

    expect(result.applied).toBe(0);
    expect(mocks.rctiApplicationCreate).not.toHaveBeenCalled();
  });

  it("uses whichever document applied the deduction most recently", async () => {
    mocks.deductionFindMany.mockResolvedValue([
      weeklyDeduction({
        overrides: {
          applications: [
            {
              amount: 50,
              appliedAt: new Date("2026-11-10T01:00:00.000Z"),
              rcti: { weekEnding: new Date("2026-11-08T00:00:00.000Z") },
            },
          ],
          jobsReportApplications: [
            {
              amount: 50,
              appliedAt: new Date("2026-11-23T01:00:00.000Z"),
              report: { weekEnding },
            },
          ],
        },
      }),
    ]);

    const result = await applyDeductionsToRcti({
      rctiId: 4,
      driverId: 10,
      weekEnding,
      tx,
    });

    expect(result.applied).toBe(0);
  });
});

describe("getPendingDeductionsForDriver", () => {
  it("leaves out a one-off deduction already applied to a jobs report", async () => {
    mocks.deductionFindMany.mockResolvedValue([
      weeklyDeduction({
        overrides: {
          frequency: "once",
          amountPerCycle: null,
          jobsReportApplications: [
            {
              amount: 300,
              appliedAt: new Date("2026-11-23T01:00:00.000Z"),
              report: { weekEnding },
            },
          ],
        },
      }),
    ]);

    const pending = await getPendingDeductionsForDriver({
      driverId: 10,
      weekEnding,
    });

    expect(pending).toEqual([]);
  });

  it("includes a monthly deduction that is due", async () => {
    mocks.deductionFindMany.mockResolvedValue([
      weeklyDeduction({ overrides: { frequency: "monthly" } }),
    ]);

    const pending = await getPendingDeductionsForDriver({
      driverId: 10,
      weekEnding,
    });

    expect(pending).toEqual([
      expect.objectContaining({ id: 1, amountToApply: 50, frequency: "monthly" }),
    ]);
  });
});

describe("removeDeductionsFromJobsReport", () => {
  it("gives applied amounts back atomically and deletes the applications", async () => {
    mocks.reportApplicationFindMany.mockResolvedValue([
      { id: 3, amount: 50, deduction: { id: 1, status: "completed" } },
    ]);

    await removeDeductionsFromJobsReport({ reportId: 8, tx });

    expect(mocks.deductionUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, status: { not: "cancelled" } },
      data: {
        amountPaid: { decrement: 50 },
        amountRemaining: { increment: 50 },
        status: "active",
        completedAt: null,
      },
    });
    expect(mocks.deductionUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "cancelled" },
      data: {
        amountPaid: { decrement: 50 },
        amountRemaining: { increment: 50 },
      },
    });
    expect(mocks.reportApplicationDelete).toHaveBeenCalledWith({
      where: { id: 3 },
    });
  });
});

describe("parseDeductionOverrides", () => {
  it("reads amounts and skips", () => {
    const result = parseDeductionOverrides({
      body: { deductionOverrides: { "1": 25, "2": null, "3": "12.5" } },
    });

    expect(result).toEqual({
      overrides: new Map([
        [1, 25],
        [2, null],
        [3, 12.5],
      ]),
    });
  });

  it("accepts zero as an amount", () => {
    expect(
      parseDeductionOverrides({ body: { deductionOverrides: { "1": 0 } } }),
    ).toEqual({ overrides: new Map([[1, 0]]) });
  });

  it("returns no overrides for an empty body", () => {
    expect(parseDeductionOverrides({ body: {} })).toEqual({
      overrides: new Map(),
    });
  });

  it.each([[true], [""], ["abc"], [{}], [-10], ["-0.01"]])(
    "rejects an override of %j",
    (value) => {
      const result = parseDeductionOverrides({
        body: { deductionOverrides: { "1": value } },
      });

      expect(result).toEqual({ error: expect.stringContaining("deduction 1") });
    },
  );
});

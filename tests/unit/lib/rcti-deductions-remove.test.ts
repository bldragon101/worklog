/**
 * @vitest-environment node
 */
import { removeDeductionsFromRcti } from "@/lib/rcti-deductions";

const mocks = vi.hoisted(() => ({
  applicationFindMany: vi.fn(),
  applicationDelete: vi.fn(),
  deductionUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    rctiDeductionApplication: {
      findMany: mocks.applicationFindMany,
      delete: mocks.applicationDelete,
    },
    rctiDeduction: { updateMany: mocks.deductionUpdate },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(client),
  };
  return { prisma: client };
});

function buildApplication({
  id,
  amount,
  deduction,
}: {
  id: number;
  amount: number;
  deduction: Record<string, unknown>;
}) {
  return {
    id,
    rctiId: 5,
    amount,
    deduction: {
      id: 20 + id,
      totalAmount: 500,
      amountPaid: 300,
      amountRemaining: 200,
      status: "active",
      completedAt: null,
      ...deduction,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("removeDeductionsFromRcti", () => {
  it("gives the applied amount back atomically and deletes the application", async () => {
    mocks.applicationFindMany.mockResolvedValue([
      buildApplication({ id: 1, amount: 100, deduction: {} }),
    ]);

    await removeDeductionsFromRcti({ rctiId: 5 });

    expect(mocks.deductionUpdate).toHaveBeenCalledWith({
      where: { id: 21, status: { not: "cancelled" } },
      data: {
        amountPaid: { decrement: 100 },
        amountRemaining: { increment: 100 },
        status: "active",
        completedAt: null,
      },
    });
    expect(mocks.applicationDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("reopens a deduction that this RCTI completed", async () => {
    mocks.applicationFindMany.mockResolvedValue([
      buildApplication({
        id: 2,
        amount: 200,
        deduction: {
          amountPaid: 500,
          amountRemaining: 0,
          status: "completed",
          completedAt: new Date(),
        },
      }),
    ]);

    await removeDeductionsFromRcti({ rctiId: 5 });

    expect(mocks.deductionUpdate.mock.calls[0][0]).toEqual({
      where: { id: 22, status: { not: "cancelled" } },
      data: {
        amountPaid: { decrement: 200 },
        amountRemaining: { increment: 200 },
        status: "active",
        completedAt: null,
      },
    });
  });

  it("does nothing when no deductions were applied", async () => {
    mocks.applicationFindMany.mockResolvedValue([]);

    await removeDeductionsFromRcti({ rctiId: 5 });

    expect(mocks.deductionUpdate).not.toHaveBeenCalled();
    expect(mocks.applicationDelete).not.toHaveBeenCalled();
  });

  it("keeps a cancelled deduction cancelled so it is not deducted again", async () => {
    mocks.applicationFindMany.mockResolvedValue([
      buildApplication({ id: 3, amount: 100, deduction: { status: "cancelled" } }),
    ]);

    await removeDeductionsFromRcti({ rctiId: 5 });

    expect(mocks.deductionUpdate).toHaveBeenCalledWith({
      where: { id: 23, status: "cancelled" },
      data: {
        amountPaid: { decrement: 100 },
        amountRemaining: { increment: 100 },
      },
    });
    for (const [call] of mocks.deductionUpdate.mock.calls) {
      if (call.where.status === "cancelled") {
        expect(call.data).not.toHaveProperty("status");
      }
    }
  });

  it("restores two applications of the same deduction without losing either", async () => {
    mocks.applicationFindMany.mockResolvedValue([
      buildApplication({ id: 4, amount: 50, deduction: { id: 30 } }),
      buildApplication({ id: 5, amount: 50, deduction: { id: 30 } }),
    ]);

    await removeDeductionsFromRcti({ rctiId: 5 });

    const restores = mocks.deductionUpdate.mock.calls.filter(
      ([call]) => call.where.status?.not === "cancelled",
    );
    expect(restores).toHaveLength(2);
    for (const [call] of restores) {
      expect(call.data.amountPaid).toEqual({ decrement: 50 });
    }
  });
});

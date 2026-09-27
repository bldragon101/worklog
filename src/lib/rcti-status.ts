import { Prisma, RctiStatus } from "@/generated/prisma/client";
import { calculateRctiTotals } from "@/lib/utils/rcti-calculations";

/**
 * Interactive transaction limits for RCTI changes. Finalising runs a few
 * queries per deduction, which can pass Prisma's 5 second default on a
 * distant database.
 */
export const RCTI_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

/**
 * Relations returned with an RCTI after a status change, so the RCTI page can
 * show lines, applied deductions and status history without refetching.
 */
export const rctiDetailInclude = {
  driver: true,
  lines: {
    orderBy: { jobDate: "asc" },
  },
  deductionApplications: {
    include: {
      deduction: {
        select: {
          id: true,
          type: true,
          description: true,
          frequency: true,
        },
      },
    },
  },
  statusChanges: {
    orderBy: { changedAt: "desc" },
  },
} satisfies Prisma.RctiInclude;

/**
 * Thrown when an RCTI is no longer in the status a transition expects,
 * usually because another request changed it first.
 */
export class RctiStatusConflictError extends Error {
  constructor({
    rctiId,
    fromStatus,
  }: {
    rctiId: number;
    fromStatus: RctiStatus;
  }) {
    super(
      `RCTI ${rctiId} is no longer ${fromStatus}. Reload the page and try again.`,
    );
    this.name = "RctiStatusConflictError";
  }
}

/**
 * Move an RCTI from one status to another inside a transaction and record who
 * did it. The update only applies while the RCTI is still in `fromStatus`;
 * otherwise RctiStatusConflictError is thrown and the transaction rolls back.
 */
export async function transitionRctiStatus({
  tx,
  rctiId,
  fromStatus,
  toStatus,
  changedBy,
  changedAt = new Date(),
  reason = null,
  data = {},
}: {
  tx: Prisma.TransactionClient;
  rctiId: number;
  fromStatus: RctiStatus;
  toStatus: RctiStatus;
  changedBy: string;
  changedAt?: Date;
  reason?: string | null;
  data?: Omit<Prisma.RctiUpdateInput, "status">;
}) {
  await tx.rctiStatusChange.create({
    data: {
      rctiId,
      fromStatus,
      toStatus,
      reason,
      changedBy,
      changedAt,
    },
  });

  try {
    return await tx.rcti.update({
      where: { id: rctiId, status: fromStatus },
      data: { ...data, status: toStatus },
      include: rctiDetailInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new RctiStatusConflictError({ rctiId, fromStatus });
    }
    throw error;
  }
}

/**
 * Mark finalised RCTIs as paid in one transaction, recording an audit row for
 * each one actually paid. RCTIs that are no longer finalised are left alone.
 */
export async function payFinalisedRctis({
  tx,
  rctiIds,
  changedBy,
  paidAt = new Date(),
}: {
  tx: Prisma.TransactionClient;
  rctiIds: number[];
  changedBy: string;
  paidAt?: Date;
}) {
  const paid = await tx.rcti.updateManyAndReturn({
    where: { id: { in: rctiIds }, status: "finalised" },
    data: { status: "paid", paidAt },
    select: { id: true },
  });

  if (paid.length > 0) {
    await tx.rctiStatusChange.createMany({
      data: paid.map(({ id }) => ({
        rctiId: id,
        fromStatus: "finalised",
        toStatus: "paid",
        changedBy,
        changedAt: paidAt,
      })),
    });
  }

  return paid.map(({ id }) => id);
}

/**
 * Totals of an RCTI's lines, before any deductions or reimbursements.
 */
export async function getRctiLineTotals({
  tx,
  rctiId,
}: {
  tx: Prisma.TransactionClient;
  rctiId: number;
}) {
  const lines = await tx.rctiLine.findMany({
    where: { rctiId },
    select: { amountExGst: true, gstAmount: true, amountIncGst: true },
  });
  return calculateRctiTotals(lines);
}

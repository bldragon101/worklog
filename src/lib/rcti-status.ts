import { Prisma, RctiStatus } from "@/generated/prisma/client";
import { calculateRctiTotals } from "@/lib/utils/rcti-calculations";
import { ApiError } from "@/lib/api-error";

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
 * usually because another request changed it first. Responds 409.
 */
export class RctiStatusConflictError extends ApiError {
  constructor({
    rctiId,
    fromStatus,
  }: {
    rctiId: number;
    fromStatus: RctiStatus;
  }) {
    super({
      status: 409,
      message: `RCTI ${rctiId} is no longer ${fromStatus}. Reload the page and try again.`,
    });
    this.name = "RctiStatusConflictError";
  }
}

/**
 * Lock an RCTI row until the transaction ends and return its current status,
 * or null when it does not exist. Changes to an RCTI's lines and its status
 * take this lock first so they cannot interleave.
 */
export async function lockRcti({
  tx,
  rctiId,
}: {
  tx: Prisma.TransactionClient;
  rctiId: number;
}): Promise<RctiStatus | null> {
  const rows = await tx.$queryRaw<Array<{ status: RctiStatus }>>`
    SELECT status FROM "Rcti" WHERE id = ${rctiId} FOR UPDATE
  `;
  return rows[0]?.status ?? null;
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

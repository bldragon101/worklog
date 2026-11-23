import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { Decimal } from "@prisma/client/runtime/client";
import type { Prisma } from "@/generated/prisma/client";
import { RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";

/**
 * Normalises a date to midnight UTC for consistent comparison
 */
function normaliseDate(date: Date): Date {
  const normalised = new Date(date);
  normalised.setUTCHours(0, 0, 0, 0);
  return normalised;
}

/**
 * Calculates the next occurrence date based on frequency
 */
function getNextOccurrence({
  startDate,
  frequency,
}: {
  startDate: Date;
  frequency: string;
}): Date {
  const next = new Date(startDate);

  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "fortnightly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      // 'once' doesn't have next occurrence
      break;
  }

  return next;
}

/**
 * The most recent time a deduction was applied, to an RCTI or a jobs report.
 */
interface LastApplication {
  amount: number | Decimal;
  weekEnding: Date;
}

/**
 * Loads the latest application of each deduction on either kind of document,
 * so a cycle applied to an RCTI is not applied again to a jobs report (or the
 * other way round).
 */
const LAST_APPLICATION_INCLUDE = {
  applications: {
    include: { rcti: { select: { weekEnding: true } } },
    orderBy: { appliedAt: "desc" },
    take: 1,
  },
  jobsReportApplications: {
    include: { report: { select: { weekEnding: true } } },
    orderBy: { appliedAt: "desc" },
    take: 1,
  },
} satisfies Prisma.RctiDeductionInclude;

type TimedApplication = {
  amount: number | Decimal;
  appliedAt?: Date;
};

/**
 * Picks the most recently applied of a deduction's latest RCTI and jobs report
 * applications.
 */
function getLastApplication({
  deduction,
}: {
  deduction: {
    applications?: Array<TimedApplication & { rcti: { weekEnding: Date } }>;
    jobsReportApplications?: Array<
      TimedApplication & { report: { weekEnding: Date } }
    >;
  };
}): LastApplication | null {
  const rctiApplication = deduction.applications?.[0];
  const reportApplication = deduction.jobsReportApplications?.[0];

  const fromRcti = rctiApplication
    ? {
        amount: rctiApplication.amount,
        weekEnding: rctiApplication.rcti.weekEnding,
        appliedAt: rctiApplication.appliedAt,
      }
    : null;
  const fromReport = reportApplication
    ? {
        amount: reportApplication.amount,
        weekEnding: reportApplication.report.weekEnding,
        appliedAt: reportApplication.appliedAt,
      }
    : null;

  if (!fromRcti || !fromReport) return fromRcti ?? fromReport;

  const rctiTime = fromRcti.appliedAt?.getTime() ?? 0;
  const reportTime = fromReport.appliedAt?.getTime() ?? 0;
  return reportTime > rctiTime ? fromReport : fromRcti;
}

/**
 * Checks if a deduction should be applied to a document based on week ending date
 */
function shouldApplyDeduction({
  deduction,
  weekEnding,
  lastApplication,
}: {
  deduction: {
    id?: number;
    startDate: Date;
    frequency: string;
    status: string;
    amountRemaining: number | Decimal;
  };
  weekEnding: Date;
  lastApplication: LastApplication | null;
}): boolean {
  // Only apply active deductions with remaining amount
  if (
    deduction.status !== "active" ||
    toNumber(deduction.amountRemaining) <= 0
  ) {
    return false;
  }

  // Check if start date has passed (compare dates only)
  const startDate = normaliseDate(new Date(deduction.startDate));
  const weekEndingDateStart = normaliseDate(new Date(weekEnding));

  if (startDate > weekEndingDateStart) {
    return false;
  }

  // For one-time deductions, apply if not already applied
  // Ignore zero-amount (skipped) applications
  if (deduction.frequency === "once") {
    if (!lastApplication) {
      return true; // No applications at all
    }
    // Check if last application was a skip (zero amount)
    const lastAmount = toNumber(lastApplication.amount);
    return lastAmount === 0; // If last was skipped, allow application
  }

  // Get the last application date for recurring deductions
  const lastApplicationDate = lastApplication?.weekEnding || null;

  // For recurring deductions, check if enough time has passed
  if (!lastApplicationDate) {
    return true; // First application
  }

  const nextOccurrence = getNextOccurrence({
    startDate: lastApplicationDate,
    frequency: deduction.frequency,
  });

  // Compare dates only (ignore time component)
  const weekEndingDateNext = normaliseDate(new Date(weekEnding));
  const nextOccurrenceDate = normaliseDate(nextOccurrence);

  return weekEndingDateNext >= nextOccurrenceDate;
}

/**
 * The document a deduction is applied to.
 */
type DeductionTarget = { rctiId: number } | { jobsReportId: number };

interface DeductionResult {
  applied: number;
  totalDeductionAmount: number;
  totalReimbursementAmount: number;
}

/**
 * Applies the driver's due deductions to an RCTI or a jobs report, records an
 * application for each (a $0 one when skipped) and updates the balances.
 */
async function applyDeductions({
  target,
  driverId,
  weekEnding,
  amountOverrides,
  tx,
}: {
  target: DeductionTarget;
  driverId: number;
  weekEnding: Date;
  amountOverrides?: Map<number, number | null>;
  tx: Prisma.TransactionClient;
}): Promise<DeductionResult> {
  // Get all active deductions for this driver within the transaction
  const deductions = await tx.rctiDeduction.findMany({
    where: {
      driverId,
      status: "active",
      startDate: {
        lte: weekEnding,
      },
    },
    include: LAST_APPLICATION_INCLUDE,
  });

  let applied = 0;
  let totalDeductionAmount = 0;
  let totalReimbursementAmount = 0;

  for (const deduction of deductions) {
    const lastApplication = getLastApplication({ deduction });

    // Check if this deduction should be applied
    if (
      !shouldApplyDeduction({
        deduction,
        weekEnding,
        lastApplication,
      })
    ) {
      continue;
    }

    // Check if there's an override for this deduction
    const override = amountOverrides?.get(deduction.id);

    // Calculate amount to apply
    let amountToApply =
      override !== undefined && override !== null
        ? override
        : toNumber(deduction.amountPerCycle || deduction.amountRemaining);

    // If override is null (skip), set amount to 0 but still create record
    if (override === null) {
      amountToApply = 0;
    }

    // Don't exceed remaining amount (only for non-skipped)
    if (amountToApply > 0) {
      const remainingAmount = toNumber(deduction.amountRemaining);
      if (amountToApply > remainingAmount) {
        amountToApply = remainingAmount;
      }
    }

    // Only update deduction amounts if not skipped
    if (amountToApply > 0) {
      // Calculate new amounts
      const newAmountPaid = toNumber(deduction.amountPaid) + amountToApply;
      const newAmountRemaining =
        toNumber(deduction.totalAmount) - newAmountPaid;

      // Use optimistic locking: only update if amountRemaining hasn't changed
      const updateResult = await tx.rctiDeduction.updateMany({
        where: {
          id: deduction.id,
          amountRemaining: deduction.amountRemaining, // Optimistic lock
          status: "active", // Only update active deductions
        },
        data: {
          amountPaid: newAmountPaid,
          amountRemaining: newAmountRemaining,
          status: newAmountRemaining <= 0 ? "completed" : "active",
          completedAt: newAmountRemaining <= 0 ? new Date() : null,
        },
      });

      // If no rows were updated, another concurrent transaction already applied this deduction
      if (updateResult.count === 0) {
        continue; // Skip this deduction
      }
    }

    // Create application record (even for skipped with $0 to track it was processed)
    if ("rctiId" in target) {
      await tx.rctiDeductionApplication.create({
        data: {
          deductionId: deduction.id,
          rctiId: target.rctiId,
          amount: amountToApply,
        },
      });
    } else {
      await tx.jobsReportDeductionApplication.create({
        data: {
          deductionId: deduction.id,
          reportId: target.jobsReportId,
          amount: amountToApply,
        },
      });
    }

    // Only count and sum non-zero applications
    if (amountToApply > 0) {
      applied++;

      if (deduction.type === "deduction") {
        totalDeductionAmount += amountToApply;
      } else {
        totalReimbursementAmount += amountToApply;
      }
    }
  }

  return {
    applied,
    totalDeductionAmount,
    totalReimbursementAmount,
  };
}

/**
 * Applies pending deductions to an RCTI
 * Runs in the caller's transaction when `tx` is given, otherwise in its own,
 * so deductions are never applied without the rest of the caller's changes.
 */
export async function applyDeductionsToRcti({
  rctiId,
  driverId,
  weekEnding,
  amountOverrides,
  tx,
}: {
  rctiId: number;
  driverId: number;
  weekEnding: Date;
  amountOverrides?: Map<number, number | null>; // deductionId -> amount (null = skip)
  tx?: Prisma.TransactionClient;
}): Promise<DeductionResult> {
  if (!tx) {
    return prisma.$transaction(
      (transaction) =>
        applyDeductionsToRcti({
          rctiId,
          driverId,
          weekEnding,
          amountOverrides,
          tx: transaction,
        }),
      RCTI_TRANSACTION_OPTIONS,
    );
  }

  return applyDeductions({
    target: { rctiId },
    driverId,
    weekEnding,
    amountOverrides,
    tx,
  });
}

/**
 * Applies the driver's due deductions to a jobs report being finalised, in the
 * caller's transaction. They share the driver's balances with RCTIs, so each
 * cycle comes off whichever document is finalised first.
 */
export async function applyDeductionsToJobsReport({
  reportId,
  driverId,
  weekEnding,
  amountOverrides,
  tx,
}: {
  reportId: number;
  driverId: number;
  weekEnding: Date;
  amountOverrides?: Map<number, number | null>; // deductionId -> amount (null = skip)
  tx: Prisma.TransactionClient;
}): Promise<DeductionResult> {
  return applyDeductions({
    target: { jobsReportId: reportId },
    driverId,
    weekEnding,
    amountOverrides,
    tx,
  });
}

/**
 * Gives an applied amount back to its deduction. A deduction cancelled after
 * the application stays cancelled, otherwise the next finalise would deduct it
 * from the driver again.
 */
async function restoreDeductionBalance({
  application,
  tx,
}: {
  application: {
    amount: number | Decimal;
    deduction: {
      id: number;
      amountPaid: number | Decimal;
      totalAmount: number | Decimal;
      status: string;
      completedAt: Date | null;
    };
  };
  tx: Prisma.TransactionClient;
}): Promise<void> {
  const deduction = application.deduction;
  const newAmountPaid =
    toNumber(deduction.amountPaid) - toNumber(application.amount);
  const newAmountRemaining = toNumber(deduction.totalAmount) - newAmountPaid;
  const isCancelled = deduction.status === "cancelled";

  await tx.rctiDeduction.update({
    where: { id: deduction.id },
    data: {
      amountPaid: newAmountPaid,
      amountRemaining: newAmountRemaining,
      status: isCancelled ? "cancelled" : "active",
      completedAt: isCancelled ? deduction.completedAt : null,
    },
  });
}

/**
 * Removes deduction applications from an RCTI (when unfinalising or reverting)
 * and gives each applied amount back to its deduction. Runs in the caller's
 * transaction when `tx` is given, otherwise in its own.
 */
export async function removeDeductionsFromRcti({
  rctiId,
  tx,
}: {
  rctiId: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  if (!tx) {
    return prisma.$transaction(
      (transaction) => removeDeductionsFromRcti({ rctiId, tx: transaction }),
      RCTI_TRANSACTION_OPTIONS,
    );
  }

  const applications = await tx.rctiDeductionApplication.findMany({
    where: { rctiId },
    include: {
      deduction: true,
    },
  });

  for (const application of applications) {
    await restoreDeductionBalance({ application, tx });
    await tx.rctiDeductionApplication.delete({
      where: { id: application.id },
    });
  }
}

/**
 * Removes deduction applications from a jobs report being unfinalised and
 * gives each applied amount back to its deduction, in the caller's
 * transaction.
 */
export async function removeDeductionsFromJobsReport({
  reportId,
  tx,
}: {
  reportId: number;
  tx: Prisma.TransactionClient;
}): Promise<void> {
  const applications = await tx.jobsReportDeductionApplication.findMany({
    where: { reportId },
    include: {
      deduction: true,
    },
  });

  for (const application of applications) {
    await restoreDeductionBalance({ application, tx });
    await tx.jobsReportDeductionApplication.delete({
      where: { id: application.id },
    });
  }
}

/**
 * Gets pending deductions that will be applied to the driver's next RCTI or
 * jobs report for the week
 */
export async function getPendingDeductionsForDriver({
  driverId,
  weekEnding,
}: {
  driverId: number;
  weekEnding: Date;
}): Promise<
  Array<{
    id: number;
    type: string;
    description: string;
    amountToApply: number;
    amountRemaining: number;
    frequency: string;
  }>
> {
  const deductions = await prisma.rctiDeduction.findMany({
    where: {
      driverId,
      status: "active",
      startDate: {
        lte: weekEnding,
      },
    },
    include: LAST_APPLICATION_INCLUDE,
  });

  const pending = [];

  for (const deduction of deductions) {
    const lastApplication = getLastApplication({ deduction });

    if (
      shouldApplyDeduction({
        deduction: { ...deduction, id: deduction.id },
        weekEnding,
        lastApplication,
      })
    ) {
      let amountToApply = toNumber(
        deduction.amountPerCycle || deduction.amountRemaining,
      );

      const remainingAmount = toNumber(deduction.amountRemaining);
      if (amountToApply > remainingAmount) {
        amountToApply = remainingAmount;
      }

      pending.push({
        id: deduction.id,
        type: deduction.type,
        description: deduction.description,
        amountToApply,
        amountRemaining: remainingAmount,
        frequency: deduction.frequency,
      });
    }
  }

  return pending;
}

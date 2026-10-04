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
 * Checks if a deduction should be applied to an RCTI based on week ending date
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
  lastApplication: {
    amount: number | Decimal;
    rcti: {
      weekEnding: Date;
    };
  } | null;
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
  const lastApplicationDate = lastApplication?.rcti.weekEnding || null;

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
}): Promise<{
  applied: number;
  totalDeductionAmount: number;
  totalReimbursementAmount: number;
}> {
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

  // Get all active deductions for this driver within the transaction
  const deductions = await tx.rctiDeduction.findMany({
    where: {
      driverId,
      status: "active",
      startDate: {
        lte: weekEnding,
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

  let applied = 0;
  let totalDeductionAmount = 0;
  let totalReimbursementAmount = 0;

  for (const deduction of deductions) {
    const lastApplication = deduction.applications[0] || null;

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
    await tx.rctiDeductionApplication.create({
      data: {
        deductionId: deduction.id,
        rctiId,
        amount: amountToApply,
      },
    });

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
    const deduction = application.deduction;
    const newAmountPaid =
      toNumber(deduction.amountPaid) - toNumber(application.amount);
    const newAmountRemaining = toNumber(deduction.totalAmount) - newAmountPaid;

    // A deduction cancelled after this application must stay cancelled,
    // otherwise the next finalise would deduct it from the driver again.
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

    await tx.rctiDeductionApplication.delete({
      where: { id: application.id },
    });
  }
}

/**
 * Gets pending deductions that will be applied to the next RCTI
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

  const pending = [];

  for (const deduction of deductions) {
    const lastApplication = deduction.applications[0] || null;

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

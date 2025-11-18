import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Normalizes a date to midnight UTC for consistent comparison
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
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
  const startDate = normalizeDate(new Date(deduction.startDate));
  const weekEndingDateStart = normalizeDate(new Date(weekEnding));

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
  const weekEndingDateNext = normalizeDate(new Date(weekEnding));
  const nextOccurrenceDate = normalizeDate(nextOccurrence);

  return weekEndingDateNext >= nextOccurrenceDate;
}

/**
 * Applies pending deductions to an RCTI
 * Wrapped in a single transaction to prevent concurrent double-application
 */
export async function applyDeductionsToRcti({
  rctiId,
  driverId,
  weekEnding,
  amountOverrides,
}: {
  rctiId: number;
  driverId: number;
  weekEnding: Date;
  amountOverrides?: Map<number, number | null>; // deductionId -> amount (null = skip)
}): Promise<{
  applied: number;
  totalDeductionAmount: number;
  totalReimbursementAmount: number;
}> {
  // Wrap entire operation in a single transaction to prevent concurrent double-application
  return await prisma.$transaction(async (tx) => {
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
  });
}

/**
 * Gets total deductions/reimbursements for an RCTI
 */
export async function getRctiDeductionSummary({
  rctiId,
}: {
  rctiId: number;
}): Promise<{
  totalDeductions: number;
  totalReimbursements: number;
  netAdjustment: number;
  applications: Array<{
    id: number;
    deductionId: number;
    description: string;
    type: string;
    amount: number;
    appliedAt: Date;
  }>;
}> {
  const applications = await prisma.rctiDeductionApplication.findMany({
    where: { rctiId },
    include: {
      deduction: {
        select: {
          id: true,
          type: true,
          description: true,
        },
      },
    },
    orderBy: {
      appliedAt: "asc",
    },
  });

  let totalDeductions = 0;
  let totalReimbursements = 0;

  const formattedApplications = applications.map((app) => {
    const amount = toNumber(app.amount);
    if (app.deduction.type === "deduction") {
      totalDeductions += amount;
    } else {
      totalReimbursements += amount;
    }

    return {
      id: app.id,
      deductionId: app.deduction.id,
      description: app.deduction.description,
      type: app.deduction.type,
      amount,
      appliedAt: app.appliedAt,
    };
  });

  return {
    totalDeductions,
    totalReimbursements,
    netAdjustment: totalReimbursements - totalDeductions,
    applications: formattedApplications,
  };
}

/**
 * Removes deduction applications from an RCTI (when unfinalising)
 */
export async function removeDeductionsFromRcti({
  rctiId,
}: {
  rctiId: number;
}): Promise<void> {
  // Get all applications for this RCTI
  const applications = await prisma.rctiDeductionApplication.findMany({
    where: { rctiId },
    include: {
      deduction: true,
    },
  });

  // Reverse each application
  for (const application of applications) {
    const deduction = application.deduction;

    // Update deduction amounts and delete application in a transaction
    const newAmountPaid =
      toNumber(deduction.amountPaid) - toNumber(application.amount);
    const newAmountRemaining = toNumber(deduction.totalAmount) - newAmountPaid;

    await prisma.$transaction(async (tx) => {
      await tx.rctiDeduction.update({
        where: { id: deduction.id },
        data: {
          amountPaid: newAmountPaid,
          amountRemaining: newAmountRemaining,
          status: "active", // Reactivate if it was completed
          completedAt: null,
        },
      });

      await tx.rctiDeductionApplication.delete({
        where: { id: application.id },
      });
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

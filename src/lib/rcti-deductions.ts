import { prisma } from "@/lib/prisma";

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
  lastApplicationDate,
}: {
  deduction: {
    startDate: Date;
    frequency: string;
    status: string;
    amountRemaining: number;
  };
  weekEnding: Date;
  lastApplicationDate: Date | null;
}): boolean {
  // Only apply active deductions with remaining amount
  if (deduction.status !== "active" || deduction.amountRemaining <= 0) {
    return false;
  }

  // Check if start date has passed
  if (new Date(deduction.startDate) > new Date(weekEnding)) {
    return false;
  }

  // For one-time deductions, apply if not already applied
  if (deduction.frequency === "once") {
    return !lastApplicationDate;
  }

  // For recurring deductions, check if enough time has passed
  if (!lastApplicationDate) {
    return true; // First application
  }

  const nextOccurrence = getNextOccurrence({
    startDate: lastApplicationDate,
    frequency: deduction.frequency,
  });

  return new Date(weekEnding) >= nextOccurrence;
}

/**
 * Applies pending deductions to an RCTI
 */
export async function applyDeductionsToRcti({
  rctiId,
  driverId,
  weekEnding,
}: {
  rctiId: number;
  driverId: number;
  weekEnding: Date;
}): Promise<{
  applied: number;
  totalDeductionAmount: number;
  totalReimbursementAmount: number;
}> {
  // Get all active deductions for this driver
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
    const lastApplication = deduction.applications[0];
    const lastApplicationDate = lastApplication?.appliedAt || null;

    // Check if this deduction should be applied
    if (
      !shouldApplyDeduction({
        deduction,
        weekEnding,
        lastApplicationDate,
      })
    ) {
      continue;
    }

    // Calculate amount to apply
    let amountToApply = deduction.amountPerCycle || deduction.amountRemaining;

    // Don't exceed remaining amount
    if (amountToApply > deduction.amountRemaining) {
      amountToApply = deduction.amountRemaining;
    }

    // Create application record and update deduction in a transaction
    const newAmountPaid = deduction.amountPaid + amountToApply;
    const newAmountRemaining = deduction.totalAmount - newAmountPaid;

    await prisma.$transaction(async (tx) => {
      await tx.rctiDeductionApplication.create({
        data: {
          deductionId: deduction.id,
          rctiId,
          amount: amountToApply,
        },
      });

      await tx.rctiDeduction.update({
        where: { id: deduction.id },
        data: {
          amountPaid: newAmountPaid,
          amountRemaining: newAmountRemaining,
          status: newAmountRemaining <= 0 ? "completed" : "active",
          completedAt: newAmountRemaining <= 0 ? new Date() : null,
        },
      });
    });

    applied++;

    if (deduction.type === "deduction") {
      totalDeductionAmount += amountToApply;
    } else {
      totalReimbursementAmount += amountToApply;
    }
  }

  return {
    applied,
    totalDeductionAmount,
    totalReimbursementAmount,
  };
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
    if (app.deduction.type === "deduction") {
      totalDeductions += app.amount;
    } else {
      totalReimbursements += app.amount;
    }

    return {
      id: app.id,
      deductionId: app.deduction.id,
      description: app.deduction.description,
      type: app.deduction.type,
      amount: app.amount,
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
    const newAmountPaid = deduction.amountPaid - application.amount;
    const newAmountRemaining = deduction.totalAmount - newAmountPaid;

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
        orderBy: {
          appliedAt: "desc",
        },
        take: 1,
      },
    },
  });

  const pending = [];

  for (const deduction of deductions) {
    const lastApplication = deduction.applications[0];
    const lastApplicationDate = lastApplication?.appliedAt || null;

    if (
      shouldApplyDeduction({
        deduction,
        weekEnding,
        lastApplicationDate,
      })
    ) {
      let amountToApply = deduction.amountPerCycle || deduction.amountRemaining;

      if (amountToApply > deduction.amountRemaining) {
        amountToApply = deduction.amountRemaining;
      }

      pending.push({
        id: deduction.id,
        type: deduction.type,
        description: deduction.description,
        amountToApply,
        amountRemaining: deduction.amountRemaining,
        frequency: deduction.frequency,
      });
    }
  }

  return pending;
}

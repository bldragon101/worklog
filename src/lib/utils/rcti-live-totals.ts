import {
  calculateLineAmounts,
  getLineDriverHoursBreakdown,
  getTotalDriverHours,
} from "@/lib/utils/rcti-calculations";
import type { PendingDeduction, RctiLine } from "@/lib/types";

export type RctiLineEdits = {
  chargedHours?: number | string;
  ratePerHour?: number | string;
  jobDate?: string;
  customer?: string;
  truckType?: string;
  description?: string;
};

export type RctiLineEditField =
  | "chargedHours"
  | "ratePerHour"
  | "jobDate"
  | "customer"
  | "truckType"
  | "description";

/**
 * Returns a line's amounts, recalculated live when its hours or rate carry
 * unsaved edits, otherwise the stored amounts, along with the job, travel and
 * total driver hours the amounts are based on.
 */
export function getLiveRctiLineAmounts({
  line,
  edits,
  gstStatus,
  gstMode,
}: {
  line: RctiLine;
  edits: RctiLineEdits | undefined;
  gstStatus: "registered" | "not_registered";
  gstMode: "exclusive" | "inclusive";
}) {
  const hours =
    edits?.chargedHours !== undefined
      ? typeof edits.chargedHours === "string"
        ? parseFloat(edits.chargedHours) || 0
        : edits.chargedHours
      : Number(line.chargedHours);
  const travelHours = Number(line.travelTimeHours ?? 0);
  const hoursChanged = edits?.chargedHours !== undefined;
  const storedBreakdown = getLineDriverHoursBreakdown({
    chargedHours: Number(line.chargedHours),
    travelTimeHours: line.travelTimeHours ?? null,
    driverCharge: line.driverCharge ?? null,
  });
  const totalDriverHours = hoursChanged
    ? getTotalDriverHours({
        chargedHours: hours,
        travelTimeHours: travelHours,
        driverCharge: null,
        hoursAdjustment: storedBreakdown.adjustmentFromBase,
      })
    : storedBreakdown.totalDriverHours;
  const rate =
    edits?.ratePerHour !== undefined
      ? typeof edits.ratePerHour === "string"
        ? parseFloat(edits.ratePerHour) || 0
        : edits.ratePerHour
      : Number(line.ratePerHour);

  const amounts =
    hoursChanged || edits?.ratePerHour !== undefined
      ? calculateLineAmounts({
          chargedHours: totalDriverHours,
          ratePerHour: rate,
          gstStatus,
          gstMode,
        })
      : {
          amountExGst: Number(line.amountExGst),
          gstAmount: Number(line.gstAmount),
          amountIncGst: Number(line.amountIncGst),
        };

  return { ...amounts, hours, travelHours, totalDriverHours };
}

/**
 * Totals the pending deductions and reimbursements for a draft RCTI, applying
 * any per-item adjustments (a null adjustment skips the item).
 */
export function getAdjustedPendingTotals({
  pending,
  adjustments,
}: {
  pending: PendingDeduction[];
  adjustments: ReadonlyMap<number, number | null>;
}) {
  const adjustedTotalDeductions = pending
    .filter((d) => d.type === "deduction")
    .reduce((sum, d) => {
      const adjustment = adjustments.get(d.id);
      if (adjustment === null) return sum;
      const amount = adjustment !== undefined ? adjustment : d.amountToApply;
      return sum + amount;
    }, 0);

  const adjustedTotalReimbursements = pending
    .filter((d) => d.type === "reimbursement")
    .reduce((sum, d) => {
      const adjustment = adjustments.get(d.id);
      if (adjustment === null) return sum;
      const amount = adjustment !== undefined ? adjustment : d.amountToApply;
      return sum + amount;
    }, 0);

  return { adjustedTotalDeductions, adjustedTotalReimbursements };
}

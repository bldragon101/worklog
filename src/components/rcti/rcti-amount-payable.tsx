import { formatCurrency } from "@/lib/utils/currency";
import {
  getAdjustedPendingTotals,
  getLiveRctiLineAmounts,
  type RctiLineEdits,
} from "@/lib/utils/rcti-live-totals";
import type { PendingDeductionsSummary, Rcti } from "@/lib/types";

export interface RctiAmountPayableProps {
  rcti: Rcti;
  editedLines: Map<number, RctiLineEdits>;
  pendingDeductions: PendingDeductionsSummary | null;
  pendingDeductionAdjustments: Map<number, number | null>;
}

/**
 * Shows the RCTI total, the net deductions or reimbursements (pending for
 * drafts, applied otherwise) and the resulting amount payable.
 */
export function RctiAmountPayable({
  rcti,
  editedLines,
  pendingDeductions,
  pendingDeductionAdjustments,
}: RctiAmountPayableProps) {
  let netAdjustment = 0;
  let hasDeductions = false;

  if (
    rcti.status === "draft" &&
    pendingDeductions &&
    pendingDeductions.pending.length > 0
  ) {
    const { adjustedTotalDeductions, adjustedTotalReimbursements } =
      getAdjustedPendingTotals({
        pending: pendingDeductions.pending,
        adjustments: pendingDeductionAdjustments,
      });

    netAdjustment = adjustedTotalReimbursements - adjustedTotalDeductions;
    hasDeductions = true;
  } else if (
    rcti.status !== "draft" &&
    rcti.deductionApplications &&
    rcti.deductionApplications.length > 0
  ) {
    const deductions = rcti.deductionApplications.reduce(
      (sum, app) =>
        sum + (app.deduction.type === "deduction" ? Number(app.amount) : 0),
      0,
    );
    const reimbursements = rcti.deductionApplications.reduce(
      (sum, app) =>
        sum +
        (app.deduction.type === "reimbursement" ? Number(app.amount) : 0),
      0,
    );
    netAdjustment = reimbursements - deductions;
    hasDeductions = true;
  }

  if (!hasDeductions) return null;

  // For finalised RCTIs, rcti.total is already adjusted, so derive the
  // original total by subtracting netAdjustment
  const currentTotal =
    rcti.status === "draft"
      ? rcti.lines?.reduce(
          (acc, line) =>
            acc +
            getLiveRctiLineAmounts({
              line,
              edits: editedLines.get(line.id),
              gstStatus: rcti.gstStatus as "registered" | "not_registered",
              gstMode: rcti.gstMode as "exclusive" | "inclusive",
            }).amountIncGst,
          0,
        ) || 0
      : Number(rcti.total) - netAdjustment;

  const adjustedTotal = currentTotal + netAdjustment;

  return (
    <div className="mt-4 p-4 bg-muted/50 border rounded-lg">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total (Inc GST):</span>
          <span
            id="rcti-total-inc-gst"
            className="font-medium text-foreground"
          >
            {formatCurrency({ amount: currentTotal })}
          </span>
        </div>
        {netAdjustment !== 0 && (
          <div className="flex justify-between text-sm">
            <span
              className={
                netAdjustment < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }
            >
              {netAdjustment < 0 ? "Deductions" : "Reimbursements"}:
            </span>
            <span
              className={
                netAdjustment < 0
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "font-medium text-green-600 dark:text-green-400"
              }
            >
              {netAdjustment >= 0 ? "+" : ""}
              {formatCurrency({ amount: netAdjustment })}
            </span>
          </div>
        )}
        <div className="pt-2 border-t border-border flex justify-between">
          <span className="font-bold text-foreground">Amount Payable:</span>
          <span
            id="rcti-amount-payable"
            className="font-bold text-foreground text-lg"
          >
            {formatCurrency({ amount: adjustedTotal })}
          </span>
        </div>
      </div>
    </div>
  );
}

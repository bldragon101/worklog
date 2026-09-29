"use client";

import type { Dispatch, SetStateAction } from "react";
import { Settings, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatCurrency } from "@/lib/utils/currency";
import { getAdjustedPendingTotals } from "@/lib/utils/rcti-live-totals";
import type { PendingDeduction, PendingDeductionsSummary } from "@/lib/types";

type AdjustmentsSetter = Dispatch<SetStateAction<Map<number, number | null>>>;

const PENDING_ROW_STYLES = {
  deduction: {
    text: "text-red-600 dark:text-red-400",
    amount: "font-medium text-red-600 dark:text-red-400",
    sign: "-",
  },
  reimbursement: {
    text: "text-green-600 dark:text-green-400",
    amount: "font-medium text-green-600 dark:text-green-400",
    sign: "+",
  },
} as const;

interface PendingDeductionRowProps {
  item: PendingDeduction;
  kind: "deduction" | "reimbursement";
  pendingDeductionAdjustments: Map<number, number | null>;
  setPendingDeductionAdjustments: AdjustmentsSetter;
}

function PendingDeductionRow({
  item: d,
  kind,
  pendingDeductionAdjustments,
  setPendingDeductionAdjustments,
}: PendingDeductionRowProps) {
  const styles = PENDING_ROW_STYLES[kind];
  const adjustment = pendingDeductionAdjustments.get(d.id);
  const isSkipped = adjustment === null;
  const adjustedAmount =
    adjustment !== undefined && adjustment !== null
      ? adjustment
      : d.amountToApply;
  const isEditing = adjustment !== undefined;

  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={
          isSkipped ? "text-muted-foreground line-through" : styles.text
        }
      >
        {d.description}
      </span>
      <div className="flex items-center gap-2">
        {isEditing && !isSkipped ? (
          <Input
            id={`pending-deduction-${d.id}-amount`}
            aria-label={`Amount for ${d.description}`}
            type="number"
            step="0.01"
            value={adjustedAmount}
            onChange={(e) => {
              const newMap = new Map(pendingDeductionAdjustments);
              newMap.set(d.id, parseFloat(e.target.value) || 0);
              setPendingDeductionAdjustments(newMap);
            }}
            className="w-24 h-7 text-sm text-right"
          />
        ) : (
          <span
            className={
              isSkipped
                ? "font-medium text-muted-foreground line-through"
                : styles.amount
            }
          >
            {styles.sign}
            {isSkipped ? "$0.00" : `$${adjustedAmount.toFixed(2)}`}
          </span>
        )}
        {isEditing ? (
          <Button
            type="button"
            id={`reset-pending-deduction-${d.id}`}
            aria-label="Undo adjustment"
            title="Undo adjustment"
            variant="ghost"
            size="sm"
            onClick={() => {
              const newMap = new Map(pendingDeductionAdjustments);
              newMap.delete(d.id);
              setPendingDeductionAdjustments(newMap);
            }}
            className="h-7 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                id={`adjust-pending-deduction-${d.id}`}
                aria-label={`Adjust or skip this ${kind}`}
                variant="outline"
                size="sm"
                className="h-7 px-2"
                title={`Adjust or skip this ${kind}`}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <Button
                  type="button"
                  id={`edit-pending-deduction-${d.id}`}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newMap = new Map(pendingDeductionAdjustments);
                    newMap.set(d.id, d.amountToApply);
                    setPendingDeductionAdjustments(newMap);
                  }}
                  className="w-full justify-start"
                >
                  Edit Amount
                </Button>
                <Button
                  type="button"
                  id={`skip-pending-deduction-${d.id}`}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newMap = new Map(pendingDeductionAdjustments);
                    newMap.set(d.id, null);
                    setPendingDeductionAdjustments(newMap);
                  }}
                  className="w-full justify-start"
                >
                  Skip This Week
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export interface RctiPendingDeductionsProps {
  pendingDeductions: PendingDeductionsSummary;
  pendingDeductionAdjustments: Map<number, number | null>;
  setPendingDeductionAdjustments: AdjustmentsSetter;
}

/**
 * Previews the deductions and reimbursements a draft RCTI will apply when
 * finalised, letting each be adjusted or skipped for this week.
 */
export function RctiPendingDeductions({
  pendingDeductions,
  pendingDeductionAdjustments,
  setPendingDeductionAdjustments,
}: RctiPendingDeductionsProps) {
  const { adjustedTotalDeductions, adjustedTotalReimbursements } =
    getAdjustedPendingTotals({
      pending: pendingDeductions.pending,
      adjustments: pendingDeductionAdjustments,
    });
  const adjustedNet = adjustedTotalReimbursements - adjustedTotalDeductions;

  return (
    <div className="p-3 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm text-foreground">
          Deductions to be Applied (when finalised):
        </h4>
        <div className="flex items-center gap-2">
          {pendingDeductionAdjustments.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingDeductionAdjustments.size} adjusted
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            Click the settings icon to adjust or skip
          </p>
        </div>
      </div>
      <div className="text-sm space-y-2">
        {pendingDeductions.pending
          .filter((d) => d.type === "deduction")
          .map((d) => (
            <PendingDeductionRow
              key={d.id}
              item={d}
              kind="deduction"
              pendingDeductionAdjustments={pendingDeductionAdjustments}
              setPendingDeductionAdjustments={setPendingDeductionAdjustments}
            />
          ))}
        {pendingDeductions.pending
          .filter((d) => d.type === "reimbursement")
          .map((d) => (
            <PendingDeductionRow
              key={d.id}
              item={d}
              kind="reimbursement"
              pendingDeductionAdjustments={pendingDeductionAdjustments}
              setPendingDeductionAdjustments={setPendingDeductionAdjustments}
            />
          ))}
        {pendingDeductions.pending.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-red-600 dark:text-red-400">
                Total Deductions:
              </span>
              <span className="font-medium text-red-600 dark:text-red-400 text-sm">
                -${adjustedTotalDeductions.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-600 dark:text-green-400">
                Total Reimbursements:
              </span>
              <span className="font-medium text-green-600 dark:text-green-400 text-sm">
                +${adjustedTotalReimbursements.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-foreground pt-1">
              <span className="text-sm">Net Adjustment:</span>
              <span className="text-sm">
                {adjustedNet >= 0 ? "+" : ""}
                {formatCurrency({ amount: adjustedNet })}
              </span>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          These will be applied when you finalise this RCTI
        </p>
      </div>
    </div>
  );
}

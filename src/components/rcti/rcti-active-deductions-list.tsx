"use client";

import type { Dispatch, SetStateAction } from "react";
import { Settings, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  PendingDeductionsSummary,
  Rcti,
  RctiDeduction,
} from "@/lib/types";

type AdjustmentsSetter = Dispatch<SetStateAction<Map<number, number | null>>>;

interface ActiveDeductionRowProps {
  rcti: Rcti;
  deduction: RctiDeduction;
  pendingDeductions: PendingDeductionsSummary | null;
  pendingDeductionAdjustments: Map<number, number | null>;
  setPendingDeductionAdjustments: AdjustmentsSetter;
  isSaving: boolean;
  onEditDeduction: ({ deduction }: { deduction: RctiDeduction }) => void;
  onDeleteDeduction: ({ deductionId }: { deductionId: number }) => void;
}

function ActiveDeductionRow({
  rcti,
  deduction,
  pendingDeductions,
  pendingDeductionAdjustments,
  setPendingDeductionAdjustments,
  isSaving,
  onEditDeduction,
  onDeleteDeduction,
}: ActiveDeductionRowProps) {
  const isSkippedThisWeek =
    pendingDeductionAdjustments.get(deduction.id) === null;

  // For draft RCTIs, show amounts as they will be after this RCTI applies
  let displayPaid = Number(deduction.amountPaid);
  let displayRemaining = Number(deduction.amountRemaining);
  if (rcti.status === "draft") {
    const pendingDeduction = pendingDeductions?.pending.find(
      (p) => p.id === deduction.id,
    );

    if (pendingDeduction) {
      const adjustment = pendingDeductionAdjustments.get(deduction.id);
      const isSkipped = adjustment === null;

      if (!isSkipped) {
        const amountToApply =
          adjustment !== undefined ? adjustment : pendingDeduction.amountToApply;
        displayPaid += amountToApply;
        displayRemaining -= amountToApply;
      }
    }
  }

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg ${
        isSkippedThisWeek ? "bg-muted/50 border-border" : ""
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`font-medium ${
              isSkippedThisWeek ? "text-muted-foreground line-through" : ""
            }`}
          >
            {deduction.description}
          </span>
          <Badge
            variant={deduction.type === "deduction" ? "destructive" : "default"}
          >
            {deduction.type}
          </Badge>
          <Badge variant="outline">{deduction.frequency}</Badge>
          {isSkippedThisWeek && (
            <Badge variant="secondary">Skipped This Week</Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Total: ${Number(deduction.totalAmount).toFixed(2)} | Paid: $
          {displayPaid.toFixed(2)} | Remaining: $
          {displayRemaining.toFixed(2)}
          {rcti.status === "draft" &&
            pendingDeductions?.pending.some((p) => p.id === deduction.id) &&
            !isSkippedThisWeek && (
              <span className="text-primary ml-1">(after this RCTI)</span>
            )}
        </div>
        {deduction.frequency !== "once" && (
          <div className="mt-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${(displayPaid / Number(deduction.totalAmount)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isSaving}
              title="Deduction options"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEditDeduction({ deduction })}
                className="w-full justify-start"
              >
                Edit Settings
              </Button>
              {rcti.status === "draft" &&
                pendingDeductions?.pending.some(
                  (p) => p.id === deduction.id,
                ) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newMap = new Map(pendingDeductionAdjustments);
                      const current = newMap.get(deduction.id);
                      if (current === null) {
                        newMap.delete(deduction.id);
                      } else {
                        newMap.set(deduction.id, null);
                      }
                      setPendingDeductionAdjustments(newMap);
                    }}
                    className="w-full justify-start"
                  >
                    {pendingDeductionAdjustments.get(deduction.id) === null
                      ? "Unskip This Week"
                      : "Skip This Week"}
                  </Button>
                )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDeleteDeduction({ deductionId: deduction.id })}
          disabled={isSaving}
          title={
            deduction.amountPaid > 0
              ? "Cancel deduction (preserves payment history)"
              : "Delete deduction"
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export interface RctiActiveDeductionsListProps {
  rcti: Rcti;
  isLoadingDeductions: boolean;
  deductions: RctiDeduction[];
  pendingDeductions: PendingDeductionsSummary | null;
  pendingDeductionAdjustments: Map<number, number | null>;
  setPendingDeductionAdjustments: AdjustmentsSetter;
  isSaving: boolean;
  onEditDeduction: ({ deduction }: { deduction: RctiDeduction }) => void;
  onDeleteDeduction: ({ deductionId }: { deductionId: number }) => void;
}

/**
 * Lists the driver's active deductions and reimbursements with their progress
 * and per-item options.
 */
export function RctiActiveDeductionsList({
  rcti,
  isLoadingDeductions,
  deductions,
  pendingDeductions,
  pendingDeductionAdjustments,
  setPendingDeductionAdjustments,
  isSaving,
  onEditDeduction,
  onDeleteDeduction,
}: RctiActiveDeductionsListProps) {
  if (isLoadingDeductions) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Loading deductions...</h4>
        <LoadingSkeleton count={2} variant="list" />
      </div>
    );
  }

  if (deductions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">
        Active Items for {rcti.driverName}:
      </h4>
      {deductions.map((deduction) => (
        <ActiveDeductionRow
          key={deduction.id}
          rcti={rcti}
          deduction={deduction}
          pendingDeductions={pendingDeductions}
          pendingDeductionAdjustments={pendingDeductionAdjustments}
          setPendingDeductionAdjustments={setPendingDeductionAdjustments}
          isSaving={isSaving}
          onEditDeduction={onEditDeduction}
          onDeleteDeduction={onDeleteDeduction}
        />
      ))}
    </div>
  );
}

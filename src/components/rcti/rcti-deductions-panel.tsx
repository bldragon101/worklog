"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { RctiActiveDeductionsList } from "@/components/rcti/rcti-active-deductions-list";
import { RctiAppliedDeductions } from "@/components/rcti/rcti-applied-deductions";
import { RctiDeductionForm } from "@/components/rcti/rcti-deduction-form";
import { RctiPendingDeductions } from "@/components/rcti/rcti-pending-deductions";
import type { RctiDeductionFormData } from "@/hooks/use-rcti-deductions";
import type {
  PendingDeductionsSummary,
  Rcti,
  RctiDeduction,
} from "@/lib/types";

export interface RctiDeductionsPanelProps {
  rcti: Rcti;
  isLoadingDeductions: boolean;
  deductions: RctiDeduction[];
  pendingDeductions: PendingDeductionsSummary | null;
  pendingDeductionAdjustments: Map<number, number | null>;
  setPendingDeductionAdjustments: Dispatch<
    SetStateAction<Map<number, number | null>>
  >;
  showDeductionForm: boolean;
  setShowDeductionForm: Dispatch<SetStateAction<boolean>>;
  deductionFormData: RctiDeductionFormData;
  setDeductionFormData: Dispatch<SetStateAction<RctiDeductionFormData>>;
  onCreateDeduction: () => void;
  onEditDeduction: ({ deduction }: { deduction: RctiDeduction }) => void;
  onDeleteDeduction: ({ deductionId }: { deductionId: number }) => void;
  isSaving: boolean;
}

/**
 * The deductions and reimbursements section for the selected RCTI: pending or
 * applied items, the create form and the driver's active items.
 */
export function RctiDeductionsPanel({
  rcti,
  isLoadingDeductions,
  deductions,
  pendingDeductions,
  pendingDeductionAdjustments,
  setPendingDeductionAdjustments,
  showDeductionForm,
  setShowDeductionForm,
  deductionFormData,
  setDeductionFormData,
  onCreateDeduction,
  onEditDeduction,
  onDeleteDeduction,
  isSaving,
}: RctiDeductionsPanelProps) {
  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Deductions & Reimbursements</h3>
          <p className="text-sm text-muted-foreground">
            Driver-specific deductions for {rcti.driverName}
          </p>
        </div>
      </div>

      {isLoadingDeductions ? (
        <div className="p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-sm text-muted-foreground">
              Loading deductions...
            </span>
          </div>
        </div>
      ) : rcti.status === "draft" && pendingDeductions ? (
        <RctiPendingDeductions
          pendingDeductions={pendingDeductions}
          pendingDeductionAdjustments={pendingDeductionAdjustments}
          setPendingDeductionAdjustments={setPendingDeductionAdjustments}
        />
      ) : rcti.status !== "draft" ? (
        <div className="p-3 border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Deductions can only be adjusted on draft RCTIs. To modify
            deductions, unfinalise this RCTI first.
          </p>
        </div>
      ) : null}

      {rcti.status !== "draft" &&
        rcti.deductionApplications &&
        rcti.deductionApplications.length > 0 && (
          <RctiAppliedDeductions
            deductionApplications={rcti.deductionApplications}
          />
        )}

      {!showDeductionForm ? (
        <Button
          type="button"
          id="add-deduction-btn"
          onClick={() => setShowDeductionForm(true)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Deduction/Reimbursement
        </Button>
      ) : (
        <RctiDeductionForm
          deductionFormData={deductionFormData}
          setDeductionFormData={setDeductionFormData}
          onSave={onCreateDeduction}
          onCancel={() => setShowDeductionForm(false)}
          isSaving={isSaving}
        />
      )}

      <RctiActiveDeductionsList
        rcti={rcti}
        isLoadingDeductions={isLoadingDeductions}
        deductions={deductions}
        pendingDeductions={pendingDeductions}
        pendingDeductionAdjustments={pendingDeductionAdjustments}
        setPendingDeductionAdjustments={setPendingDeductionAdjustments}
        isSaving={isSaving}
        onEditDeduction={onEditDeduction}
        onDeleteDeduction={onDeleteDeduction}
      />
    </div>
  );
}

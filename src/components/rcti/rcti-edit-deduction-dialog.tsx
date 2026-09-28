"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RctiDeductionFormData } from "@/hooks/use-rcti-deductions";
import type { RctiDeduction } from "@/lib/types";

export interface RctiEditDeductionDialogProps {
  editingDeduction: RctiDeduction;
  deductionFormData: RctiDeductionFormData;
  setDeductionFormData: Dispatch<SetStateAction<RctiDeductionFormData>>;
  onUpdate: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

/**
 * Overlay for editing an existing deduction or reimbursement's settings.
 */
export function RctiEditDeductionDialog({
  editingDeduction,
  deductionFormData,
  setDeductionFormData,
  onUpdate,
  onCancel,
  isSaving,
}: RctiEditDeductionDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">
          Edit{" "}
          {editingDeduction.type === "deduction"
            ? "Deduction"
            : "Reimbursement"}
        </h3>
        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              type="text"
              value={deductionFormData.description}
              onChange={(e) =>
                setDeductionFormData({
                  ...deductionFormData,
                  description: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="edit-total-amount">Total Amount</Label>
            <Input
              id="edit-total-amount"
              type="number"
              step="0.01"
              value={deductionFormData.totalAmount}
              onChange={(e) =>
                setDeductionFormData({
                  ...deductionFormData,
                  totalAmount: e.target.value,
                })
              }
              disabled
              title="Total amount cannot be changed after creation"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total amount cannot be changed
            </p>
          </div>
          <div>
            <Label htmlFor="edit-frequency">Frequency</Label>
            <Select
              value={deductionFormData.frequency}
              onValueChange={(value) =>
                setDeductionFormData({
                  ...deductionFormData,
                  frequency: value,
                })
              }
            >
              <SelectTrigger id="edit-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {deductionFormData.frequency !== "once" && (
            <div>
              <Label htmlFor="edit-amount-per-cycle">Amount Per Cycle</Label>
              <Input
                id="edit-amount-per-cycle"
                type="number"
                step="0.01"
                value={deductionFormData.amountPerCycle}
                onChange={(e) =>
                  setDeductionFormData({
                    ...deductionFormData,
                    amountPerCycle: e.target.value,
                  })
                }
              />
            </div>
          )}
          <div>
            <Label htmlFor="edit-start-date">Start Date</Label>
            <Input
              id="edit-start-date"
              type="date"
              value={deductionFormData.startDate}
              onChange={(e) =>
                setDeductionFormData({
                  ...deductionFormData,
                  startDate: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Textarea
              id="edit-notes"
              value={deductionFormData.notes}
              onChange={(e) =>
                setDeductionFormData({
                  ...deductionFormData,
                  notes: e.target.value,
                })
              }
              rows={2}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            onClick={() => onUpdate()}
            disabled={isSaving || !deductionFormData.description.trim()}
            className="flex-1"
          >
            {isSaving ? <Spinner size="sm" /> : "Update"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onCancel()}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

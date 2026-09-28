"use client";

import type { Dispatch, SetStateAction } from "react";
import { Save } from "lucide-react";
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

export interface RctiDeductionFormProps {
  deductionFormData: RctiDeductionFormData;
  setDeductionFormData: Dispatch<SetStateAction<RctiDeductionFormData>>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

/**
 * Inline form for creating a deduction or reimbursement for the RCTI's driver.
 */
export function RctiDeductionForm({
  deductionFormData,
  setDeductionFormData,
  onSave,
  onCancel,
  isSaving,
}: RctiDeductionFormProps) {
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deduction-type">Type</Label>
          <Select
            value={deductionFormData.type}
            onValueChange={(value) =>
              setDeductionFormData({
                ...deductionFormData,
                type: value,
              })
            }
          >
            <SelectTrigger id="deduction-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deduction">Deduction</SelectItem>
              <SelectItem value="reimbursement">Reimbursement</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deduction-frequency">Frequency</Label>
          <Select
            value={deductionFormData.frequency}
            onValueChange={(value) =>
              setDeductionFormData({
                ...deductionFormData,
                frequency: value,
              })
            }
          >
            <SelectTrigger id="deduction-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">One-off</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="fortnightly">Fortnightly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deduction-description">Description</Label>
        <Input
          id="deduction-description"
          value={deductionFormData.description}
          onChange={(e) =>
            setDeductionFormData({
              ...deductionFormData,
              description: e.target.value,
            })
          }
          placeholder="e.g., Fuel advance repayment"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deduction-total">Total Amount ($)</Label>
          <Input
            id="deduction-total"
            type="number"
            step="0.01"
            value={deductionFormData.totalAmount}
            onChange={(e) =>
              setDeductionFormData({
                ...deductionFormData,
                totalAmount: e.target.value,
              })
            }
          />
        </div>
        {deductionFormData.frequency !== "once" && (
          <div className="space-y-2">
            <Label htmlFor="deduction-per-cycle">Amount per cycle ($)</Label>
            <Input
              id="deduction-per-cycle"
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="deduction-start-date">Start Date</Label>
        <Input
          id="deduction-start-date"
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
      <div className="space-y-2">
        <Label htmlFor="deduction-notes">Notes (optional)</Label>
        <Textarea
          id="deduction-notes"
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
      <div className="flex gap-2">
        <Button
          type="button"
          id="save-deduction-btn"
          size="sm"
          onClick={() => onSave()}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
        <Button
          type="button"
          id="cancel-deduction-btn"
          size="sm"
          variant="outline"
          onClick={() => onCancel()}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

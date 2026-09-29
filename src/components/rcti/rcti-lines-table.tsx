"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RctiAmountPayable } from "@/components/rcti/rcti-amount-payable";
import { RctiLineRow } from "@/components/rcti/rcti-line-row";
import { RctiManualLineRow } from "@/components/rcti/rcti-manual-line-row";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getLiveRctiLineAmounts,
  type RctiLineEditField,
  type RctiLineEdits,
} from "@/lib/utils/rcti-live-totals";
import type { RctiManualLineData } from "@/hooks/use-rcti-lines";
import type { PendingDeductionsSummary, Rcti } from "@/lib/types";

export interface RctiLinesTableProps {
  rcti: Rcti;
  editedLines: Map<number, RctiLineEdits>;
  onLineEdit: ({
    lineId,
    field,
    value,
  }: {
    lineId: number;
    field: RctiLineEditField;
    value: number | string;
  }) => void;
  deletingLineId: number | null;
  onRemoveLine: ({ lineId }: { lineId: number }) => void;
  onOpenAddJobs: () => void;
  isAddingManualLine: boolean;
  onStartManualLine: () => void;
  manualLineData: RctiManualLineData;
  setManualLineData: Dispatch<SetStateAction<RctiManualLineData>>;
  onSaveManualLine: () => void;
  onCancelManualLine: () => void;
  isSaving: boolean;
  pendingDeductions: PendingDeductionsSummary | null;
  pendingDeductionAdjustments: Map<number, number | null>;
}

export function RctiLinesTable({
  rcti,
  editedLines,
  onLineEdit,
  deletingLineId,
  onRemoveLine,
  onOpenAddJobs,
  isAddingManualLine,
  onStartManualLine,
  manualLineData,
  setManualLineData,
  onSaveManualLine,
  onCancelManualLine,
  isSaving,
  pendingDeductions,
  pendingDeductionAdjustments,
}: RctiLinesTableProps) {
  // Calculate live totals based on edited amounts
  const totals = rcti.lines?.reduce(
    (acc, line) => {
      const amounts = getLiveRctiLineAmounts({
        line,
        edits: editedLines.get(line.id),
        gstStatus: rcti.gstStatus as "registered" | "not_registered",
        gstMode: rcti.gstMode as "exclusive" | "inclusive",
      });

      return {
        subtotal: acc.subtotal + amounts.amountExGst,
        gst: acc.gst + amounts.gstAmount,
        total: acc.total + amounts.amountIncGst,
      };
    },
    { subtotal: 0, gst: 0, total: 0 },
  ) || {
    subtotal: 0,
    gst: 0,
    total: 0,
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Invoice Lines</h3>
            <p className="text-sm text-muted-foreground">
              {rcti.lines?.length || 0} jobs included
            </p>
          </div>
          {rcti.status === "draft" && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenAddJobs()}
                disabled={isAddingManualLine}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Jobs
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => onStartManualLine()}
                disabled={isAddingManualLine}
                id="add-manual-line-btn"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Line
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 text-sm font-medium w-32">
                  Date
                </th>
                <th className="text-left p-2 text-sm font-medium">Customer</th>
                <th className="text-left p-2 text-sm font-medium w-28">
                  Truck Type
                </th>
                <th className="text-left p-2 text-sm font-medium">
                  Description
                </th>
                <th className="text-right p-2 text-sm font-medium w-24">
                  Job Hours
                </th>
                <th className="text-right p-2 text-sm font-medium w-28">
                  Driver Hours
                </th>
                <th className="text-right p-2 text-sm font-medium w-28">
                  Rate
                </th>
                <th className="text-right p-2 text-sm font-medium w-28">
                  Ex GST
                </th>
                <th className="text-right p-2 text-sm font-medium w-24">
                  GST
                </th>
                <th className="text-right p-2 text-sm font-medium w-28">
                  Inc GST
                </th>
                {rcti.status === "draft" && (
                  <th className="p-2 text-sm font-medium w-16">Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isAddingManualLine && (
                <RctiManualLineRow
                  manualLineData={manualLineData}
                  setManualLineData={setManualLineData}
                  onSave={onSaveManualLine}
                  onCancel={onCancelManualLine}
                  isSaving={isSaving}
                />
              )}
              {rcti.lines?.map((line) => (
                <RctiLineRow
                  key={line.id}
                  rcti={rcti}
                  line={line}
                  edits={editedLines.get(line.id)}
                  deletingLineId={deletingLineId}
                  onLineEdit={onLineEdit}
                  onRemoveLine={onRemoveLine}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold bg-muted/30">
                <td colSpan={7} className="p-2 text-right text-sm">
                  Totals:
                </td>
                <td
                  id="rcti-lines-subtotal"
                  className="p-2 text-right text-sm font-bold"
                >
                  {formatCurrency({ amount: totals.subtotal })}
                </td>
                <td
                  id="rcti-lines-gst"
                  className="p-2 text-right text-sm font-bold"
                >
                  {formatCurrency({ amount: totals.gst })}
                </td>
                <td
                  id="rcti-lines-total"
                  className="p-2 text-right text-sm font-bold"
                >
                  {formatCurrency({ amount: totals.total })}
                </td>
                {rcti.status === "draft" && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>

        <RctiAmountPayable
          rcti={rcti}
          editedLines={editedLines}
          pendingDeductions={pendingDeductions}
          pendingDeductionAdjustments={pendingDeductionAdjustments}
        />
      </div>
    </div>
  );
}

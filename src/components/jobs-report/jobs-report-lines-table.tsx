"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobsReportLineRow } from "@/components/jobs-report/jobs-report-line-row";
import { JobsReportManualLineRow } from "@/components/jobs-report/jobs-report-manual-line-row";
import { getLineDriverHours } from "@/lib/utils/rcti-calculations";
import type { JobsReportManualLineData } from "@/hooks/use-jobs-report-manual-lines";
import type { JobsReport } from "@/lib/types";

export interface JobsReportLinesTableProps {
  report: JobsReport;
  isAddingManualLine: boolean;
  editingLineId: number | null;
  onStartManualLine: () => void;
  onStartEditLine: ({ line }: { line: JobsReport["lines"][number] }) => void;
  manualLineData: JobsReportManualLineData;
  setManualLineData: Dispatch<SetStateAction<JobsReportManualLineData>>;
  onSaveManualLine: () => void;
  onCancelManualLine: () => void;
  isSavingManualLine: boolean;
  deletingLineId: number | null;
  onRemoveManualLine: ({ lineId }: { lineId: number }) => void;
}

/**
 * The selected report's jobs table with job and driver hour totals, plus
 * adding, editing and removing manual lines on drafts.
 */
export function JobsReportLinesTable({
  report,
  isAddingManualLine,
  editingLineId,
  onStartManualLine,
  onStartEditLine,
  manualLineData,
  setManualLineData,
  onSaveManualLine,
  onCancelManualLine,
  isSavingManualLine,
  deletingLineId,
  onRemoveManualLine,
}: JobsReportLinesTableProps) {
  const totalHours = useMemo(() => {
    let total = 0;
    for (const line of report.lines) total += Number(line.chargedHours ?? 0);
    return total;
  }, [report]);

  const totalDriverHours = useMemo(() => {
    let total = 0;
    for (const line of report.lines) {
      total += getLineDriverHours({
        chargedHours: line.chargedHours,
        travelTimeHours: line.travelTimeHours,
        driverCharge: line.driverCharge,
      });
    }
    return total;
  }, [report]);

  const isDraftReport = report.status === "draft";
  const isLineFormOpen = isAddingManualLine || editingLineId !== null;

  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold">
          Jobs ({report.lines?.length ?? 0})
        </h4>
        {isDraftReport && (
          <Button
            type="button"
            id="jr-add-manual-line-btn"
            size="sm"
            onClick={() => onStartManualLine()}
            disabled={isLineFormOpen}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add Manual Line
          </Button>
        )}
      </div>

      {(!report.lines || report.lines.length === 0) && !isAddingManualLine ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Briefcase
            className="h-8 w-8 mx-auto mb-2 opacity-50"
            aria-hidden="true"
          />
          <p className="text-sm">No jobs found for this driver and week</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                  Customer
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  Vehicle Type
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                  Description
                </th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  Job Hours
                </th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  Driver Hours
                </th>
                {isDraftReport && (
                  <th className="w-24 px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isAddingManualLine && (
                <JobsReportManualLineRow
                  manualLineData={manualLineData}
                  setManualLineData={setManualLineData}
                  onSave={onSaveManualLine}
                  onCancel={onCancelManualLine}
                  isSaving={isSavingManualLine}
                  isEditing={false}
                />
              )}
              {report.lines.map((line) =>
                line.id === editingLineId ? (
                  <JobsReportManualLineRow
                    key={line.id}
                    manualLineData={manualLineData}
                    setManualLineData={setManualLineData}
                    onSave={onSaveManualLine}
                    onCancel={onCancelManualLine}
                    isSaving={isSavingManualLine}
                    isEditing
                  />
                ) : (
                  <JobsReportLineRow
                    key={line.id}
                    line={line}
                    isDraftReport={isDraftReport}
                    isLineFormOpen={isLineFormOpen}
                    deletingLineId={deletingLineId}
                    onStartEditLine={onStartEditLine}
                    onRemoveManualLine={onRemoveManualLine}
                  />
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/20">
                <td
                  colSpan={4}
                  className="px-3 py-2.5 text-right font-semibold text-sm"
                >
                  Totals
                </td>
                <td
                  id="jr-total-hours"
                  className="px-3 py-2.5 text-right font-bold font-mono text-sm"
                >
                  {totalHours.toFixed(2)}
                </td>
                <td
                  id="jr-total-driver-hours"
                  className="px-3 py-2.5 text-right font-bold font-mono text-sm text-emerald-700 dark:text-emerald-400"
                >
                  {totalDriverHours.toFixed(2)}
                </td>
                {isDraftReport && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { DriverHoursCell } from "@/components/jobs-report/driver-hours-cell";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import type { JobsReport } from "@/lib/types";

type JobsReportLine = JobsReport["lines"][number];

export interface JobsReportLineRowProps {
  line: JobsReportLine;
  isDraftReport: boolean;
  isLineFormOpen: boolean;
  deletingLineId: number | null;
  onStartEditLine: ({ line }: { line: JobsReportLine }) => void;
  onRemoveManualLine: ({ lineId }: { lineId: number }) => void;
}

/**
 * A saved line on a jobs report. Manual lines on drafts can be edited or
 * removed; lines built from jobs are managed on the jobs page.
 */
export function JobsReportLineRow({
  line,
  isDraftReport,
  isLineFormOpen,
  deletingLineId,
  onStartEditLine,
  onRemoveManualLine,
}: JobsReportLineRowProps) {
  const isManualLine = line.jobId === null;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
        {formatDateDDMMYYYY({ isoString: line.jobDate })}
      </td>
      <td className="px-3 py-2.5">{line.customer}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">{line.truckType}</td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {line.description ?? <span className="italic opacity-50">—</span>}
        {(line.startTime || line.finishTime) && (
          <div className="font-mono text-xs text-muted-foreground/70 mt-0.5">
            {line.startTime ?? "—"}
            {" – "}
            {line.finishTime ?? "—"}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
        {line.chargedHours == null
          ? "—"
          : Number(line.chargedHours).toFixed(2)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold whitespace-nowrap text-emerald-700 dark:text-emerald-400">
        <DriverHoursCell
          chargedHours={line.chargedHours}
          travelTimeHours={line.travelTimeHours}
          driverCharge={line.driverCharge}
        />
      </td>
      {isDraftReport && (
        <td className="px-3 py-2.5 text-right">
          {isManualLine ? (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                id={`jr-edit-line-${line.id}-btn`}
                variant="ghost"
                size="icon"
                title="Edit manual line"
                onClick={() => onStartEditLine({ line })}
                disabled={isLineFormOpen || deletingLineId !== null}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                id={`jr-remove-line-${line.id}-btn`}
                variant="ghost"
                size="icon"
                title="Remove manual line"
                onClick={() => onRemoveManualLine({ lineId: line.id })}
                disabled={deletingLineId !== null}
              >
                {deletingLineId === line.id ? (
                  <Spinner size="sm" />
                ) : (
                  <Trash2
                    className="h-4 w-4 text-destructive"
                    aria-hidden="true"
                  />
                )}
              </Button>
            </div>
          ) : null}
        </td>
      )}
    </tr>
  );
}

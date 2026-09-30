"use client";

import type { Dispatch, SetStateAction } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/skeleton";
import type { JobsReportManualLineData } from "@/hooks/use-jobs-report-manual-lines";

export interface JobsReportManualLineRowProps {
  manualLineData: JobsReportManualLineData;
  setManualLineData: Dispatch<SetStateAction<JobsReportManualLineData>>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

/**
 * Inline table row for entering a manual line on a draft jobs report.
 */
export function JobsReportManualLineRow({
  manualLineData,
  setManualLineData,
  onSave,
  onCancel,
  isSaving,
}: JobsReportManualLineRowProps) {
  return (
    <tr className="border-b bg-accent/50">
      <td className="px-3 py-2">
        <Input
          id="jr-manual-line-date"
          type="date"
          aria-label="Date"
          value={manualLineData.jobDate}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              jobDate: e.target.value,
            })
          }
        />
      </td>
      <td className="px-3 py-2">
        <Input
          id="jr-manual-line-customer"
          type="text"
          placeholder="Customer"
          aria-label="Customer"
          value={manualLineData.customer}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              customer: e.target.value,
            })
          }
        />
      </td>
      <td className="px-3 py-2">
        <Input
          id="jr-manual-line-truck-type"
          type="text"
          placeholder="Vehicle Type"
          aria-label="Vehicle Type"
          value={manualLineData.truckType}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              truckType: e.target.value,
            })
          }
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Input
            id="jr-manual-line-start-time"
            type="time"
            aria-label="Start time"
            value={manualLineData.startTime}
            onChange={(e) =>
              setManualLineData({
                ...manualLineData,
                startTime: e.target.value,
              })
            }
          />
          <span className="text-muted-foreground">–</span>
          <Input
            id="jr-manual-line-finish-time"
            type="time"
            aria-label="Finish time"
            value={manualLineData.finishTime}
            onChange={(e) =>
              setManualLineData({
                ...manualLineData,
                finishTime: e.target.value,
              })
            }
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          id="jr-manual-line-hours"
          type="number"
          min="0"
          step="0.25"
          placeholder="Hours"
          aria-label="Job hours"
          value={manualLineData.chargedHours}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              chargedHours: e.target.value,
            })
          }
          className="w-24 text-right ml-auto"
        />
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold whitespace-nowrap text-emerald-700 dark:text-emerald-400">
        {(parseFloat(manualLineData.chargedHours) || 0).toFixed(2)}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <Button
            type="button"
            id="jr-save-manual-line-btn"
            size="sm"
            onClick={() => onSave()}
            disabled={isSaving}
            title="Save line"
          >
            {isSaving ? (
              <Spinner size="sm" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            id="jr-cancel-manual-line-btn"
            size="sm"
            variant="ghost"
            onClick={() => onCancel()}
            disabled={isSaving}
            title="Cancel"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

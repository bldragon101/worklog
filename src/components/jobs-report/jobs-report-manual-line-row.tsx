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
  isEditing: boolean;
}

/**
 * Inline table row for entering a new manual line, or editing a saved one, on
 * a draft jobs report.
 */
export function JobsReportManualLineRow({
  manualLineData,
  setManualLineData,
  onSave,
  onCancel,
  isSaving,
  isEditing,
}: JobsReportManualLineRowProps) {
  const updateField = ({
    field,
    value,
  }: {
    field: keyof JobsReportManualLineData;
    value: string;
  }) => {
    setManualLineData((previous) => ({ ...previous, [field]: value }));
  };

  const defaultDriverHours =
    (parseFloat(manualLineData.chargedHours) || 0) +
    (parseFloat(manualLineData.travelTimeHours) || 0);

  return (
    <tr className="border-b bg-accent/50 align-top">
      <td className="px-3 py-2">
        <Input
          id="jr-manual-line-date"
          type="date"
          aria-label="Date"
          value={manualLineData.jobDate}
          onChange={(e) =>
            updateField({ field: "jobDate", value: e.target.value })
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
            updateField({ field: "customer", value: e.target.value })
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
            updateField({ field: "truckType", value: e.target.value })
          }
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Input
            id="jr-manual-line-description"
            type="text"
            placeholder="Description (optional)"
            aria-label="Description"
            value={manualLineData.description}
            onChange={(e) =>
              updateField({ field: "description", value: e.target.value })
            }
          />
          <div className="flex items-center gap-1">
            <Input
              id="jr-manual-line-start-time"
              type="time"
              aria-label="Start time"
              value={manualLineData.startTime}
              onChange={(e) =>
                updateField({ field: "startTime", value: e.target.value })
              }
            />
            <span className="text-muted-foreground">–</span>
            <Input
              id="jr-manual-line-finish-time"
              type="time"
              aria-label="Finish time"
              value={manualLineData.finishTime}
              onChange={(e) =>
                updateField({ field: "finishTime", value: e.target.value })
              }
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-end gap-1">
          <Input
            id="jr-manual-line-hours"
            type="number"
            min="0"
            step="0.25"
            placeholder="Hours"
            aria-label="Job hours"
            value={manualLineData.chargedHours}
            onChange={(e) =>
              updateField({ field: "chargedHours", value: e.target.value })
            }
            className="w-24 text-right"
          />
          <Input
            id="jr-manual-line-travel-hours"
            type="number"
            min="0"
            step="0.25"
            placeholder="Travel"
            aria-label="Travel hours"
            title="Travel hours paid on top of job hours"
            value={manualLineData.travelTimeHours}
            onChange={(e) =>
              updateField({ field: "travelTimeHours", value: e.target.value })
            }
            className="w-24 text-right"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          id="jr-manual-line-driver-hours"
          type="number"
          min="0"
          step="0.25"
          placeholder={defaultDriverHours.toFixed(2)}
          aria-label="Driver hours"
          title="Leave blank to pay job hours plus travel"
          value={manualLineData.driverCharge}
          onChange={(e) =>
            updateField({ field: "driverCharge", value: e.target.value })
          }
          className="w-24 text-right ml-auto"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <Button
            type="button"
            id="jr-save-manual-line-btn"
            size="sm"
            onClick={() => onSave()}
            disabled={isSaving}
            title={isEditing ? "Save changes" : "Save line"}
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

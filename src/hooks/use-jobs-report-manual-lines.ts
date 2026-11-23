import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { JobsReport } from "@/lib/types";

export type JobsReportManualLineData = {
  jobDate: string;
  customer: string;
  truckType: string;
  description: string;
  startTime: string;
  finishTime: string;
  chargedHours: string;
  travelTimeHours: string;
  /** Driver hours total; blank pays job hours plus travel time. */
  driverCharge: string;
};

type JobsReportLine = JobsReport["lines"][number];

const EMPTY_MANUAL_LINE: JobsReportManualLineData = {
  jobDate: "",
  customer: "",
  truckType: "",
  description: "",
  startTime: "",
  finishTime: "",
  chargedHours: "",
  travelTimeHours: "",
  driverCharge: "",
};

function formatOptionalHours({
  value,
}: {
  value: number | string | null;
}): string {
  return value == null ? "" : String(Number(value));
}

/**
 * Adds, edits and removes manual lines on the selected jobs report. One line
 * form is open at a time: a new line when `editingLineId` is null, otherwise
 * the saved line being edited.
 */
export function useJobsReportManualLines({
  selectedReport,
  applyUpdatedReport,
}: {
  selectedReport: JobsReport | null;
  applyUpdatedReport: ({ updated }: { updated: JobsReport }) => void;
}) {
  const [isAddingManualLine, setIsAddingManualLine] = useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [manualLineData, setManualLineData] =
    useState<JobsReportManualLineData>(EMPTY_MANUAL_LINE);
  const [isSavingManualLine, setIsSavingManualLine] = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<number | null>(null);

  const handleStartManualLine = () => {
    if (!selectedReport) return;
    setEditingLineId(null);
    setManualLineData({
      ...EMPTY_MANUAL_LINE,
      jobDate: selectedReport.weekEnding.slice(0, 10),
    });
    setIsAddingManualLine(true);
  };

  const handleStartEditLine = ({ line }: { line: JobsReportLine }) => {
    setIsAddingManualLine(false);
    setEditingLineId(line.id);
    setManualLineData({
      jobDate: line.jobDate.slice(0, 10),
      customer: line.customer,
      truckType: line.truckType,
      description: line.description ?? "",
      startTime: line.startTime ?? "",
      finishTime: line.finishTime ?? "",
      chargedHours: formatOptionalHours({ value: line.chargedHours }),
      travelTimeHours: formatOptionalHours({ value: line.travelTimeHours }),
      driverCharge: formatOptionalHours({ value: line.driverCharge }),
    });
  };

  const handleCancelManualLine = () => {
    setIsAddingManualLine(false);
    setEditingLineId(null);
    setManualLineData(EMPTY_MANUAL_LINE);
  };

  const handleSaveManualLine = async () => {
    if (!selectedReport) return;

    const { jobDate, customer, truckType, chargedHours } = manualLineData;
    if (
      !jobDate ||
      !customer.trim() ||
      !truckType.trim() ||
      chargedHours.trim() === ""
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in date, customer, vehicle type and hours",
        variant: "destructive",
      });
      return;
    }

    const isEditing = editingLineId !== null;
    const failureMessage = isEditing
      ? "Failed to update line"
      : "Failed to add manual line";

    setIsSavingManualLine(true);
    try {
      const response = await fetch(
        isEditing
          ? `/api/jobs-report/${selectedReport.id}/lines/${editingLineId}`
          : `/api/jobs-report/${selectedReport.id}/lines`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manualLine: manualLineData }),
        },
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error((err as { error?: string }).error ?? failureMessage);
      }
      const updated = (await response.json()) as JobsReport;
      applyUpdatedReport({ updated });
      handleCancelManualLine();
      toast({
        title: "Success",
        description: isEditing
          ? "Manual line updated"
          : "Manual line added successfully",
      });
    } catch (error) {
      console.error("Error saving manual line:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : failureMessage,
        variant: "destructive",
      });
    } finally {
      setIsSavingManualLine(false);
    }
  };

  const handleRemoveManualLine = async ({ lineId }: { lineId: number }) => {
    if (!selectedReport) return;
    setDeletingLineId(lineId);
    try {
      const response = await fetch(
        `/api/jobs-report/${selectedReport.id}/lines/${lineId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to remove line",
        );
      }
      const updated = (await response.json()) as JobsReport;
      applyUpdatedReport({ updated });
      if (editingLineId === lineId) handleCancelManualLine();
      toast({ title: "Success", description: "Manual line removed" });
    } catch (error) {
      console.error("Error removing manual line:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove line",
        variant: "destructive",
      });
    } finally {
      setDeletingLineId(null);
    }
  };

  return {
    isAddingManualLine,
    editingLineId,
    manualLineData,
    setManualLineData,
    isSavingManualLine,
    deletingLineId,
    handleStartManualLine,
    handleStartEditLine,
    handleCancelManualLine,
    handleSaveManualLine,
    handleRemoveManualLine,
  };
}

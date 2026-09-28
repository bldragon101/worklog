import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { JobsReport } from "@/lib/types";

export type JobsReportManualLineData = {
  jobDate: string;
  customer: string;
  truckType: string;
  startTime: string;
  finishTime: string;
  chargedHours: string;
};

const EMPTY_MANUAL_LINE: JobsReportManualLineData = {
  jobDate: "",
  customer: "",
  truckType: "",
  startTime: "",
  finishTime: "",
  chargedHours: "",
};

/**
 * Adds and removes manual lines on the selected jobs report.
 */
export function useJobsReportManualLines({
  selectedReport,
  applyUpdatedReport,
}: {
  selectedReport: JobsReport | null;
  applyUpdatedReport: ({ updated }: { updated: JobsReport }) => void;
}) {
  const [isAddingManualLine, setIsAddingManualLine] = useState(false);
  const [manualLineData, setManualLineData] =
    useState<JobsReportManualLineData>(EMPTY_MANUAL_LINE);
  const [isSavingManualLine, setIsSavingManualLine] = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<number | null>(null);

  const handleStartManualLine = () => {
    if (!selectedReport) return;
    setManualLineData({
      ...EMPTY_MANUAL_LINE,
      jobDate: selectedReport.weekEnding.slice(0, 10),
    });
    setIsAddingManualLine(true);
  };

  const handleCancelManualLine = () => {
    setIsAddingManualLine(false);
    setManualLineData(EMPTY_MANUAL_LINE);
  };

  const handleAddManualLine = async () => {
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

    setIsSavingManualLine(true);
    try {
      const response = await fetch(
        `/api/jobs-report/${selectedReport.id}/lines`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manualLine: manualLineData }),
        },
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to add manual line",
        );
      }
      const updated = (await response.json()) as JobsReport;
      applyUpdatedReport({ updated });
      setIsAddingManualLine(false);
      setManualLineData(EMPTY_MANUAL_LINE);
      toast({ title: "Success", description: "Manual line added successfully" });
    } catch (error) {
      console.error("Error adding manual line:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add manual line",
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
    manualLineData,
    setManualLineData,
    isSavingManualLine,
    deletingLineId,
    handleStartManualLine,
    handleCancelManualLine,
    handleAddManualLine,
    handleRemoveManualLine,
  };
}

import { useState, type Dispatch, type SetStateAction } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type {
  RctiLineEditField,
  RctiLineEdits,
} from "@/lib/utils/rcti-live-totals";
import type { Job, Rcti } from "@/lib/types";

export type RctiManualLineData = {
  jobDate: string;
  customer: string;
  truckType: string;
  description: string;
  chargedHours: string;
  ratePerHour: string;
};

/**
 * Returns a blank manual line dated today.
 */
export function createEmptyManualLine(): RctiManualLineData {
  return {
    jobDate: format(new Date(), "yyyy-MM-dd"),
    customer: "",
    truckType: "",
    description: "",
    chargedHours: "",
    ratePerHour: "",
  };
}

/**
 * Manages the selected RCTI's invoice lines: unsaved line edits, removing
 * lines, adding jobs and adding manual lines.
 */
export function useRctiLines({
  selectedRcti,
  setSelectedRcti,
  fetchRctis,
  setIsSaving,
}: {
  selectedRcti: Rcti | null;
  setSelectedRcti: Dispatch<SetStateAction<Rcti | null>>;
  fetchRctis: () => Promise<Rcti[]>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
}) {
  const [editedLines, setEditedLines] = useState<Map<number, RctiLineEdits>>(
    new Map(),
  );
  const [deletingLineId, setDeletingLineId] = useState<number | null>(null);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [showAddJobDialog, setShowAddJobDialog] = useState(false);
  const [selectedJobsToAdd, setSelectedJobsToAdd] = useState<number[]>([]);
  const [isAddingManualLine, setIsAddingManualLine] = useState(false);
  const [manualLineData, setManualLineData] = useState<RctiManualLineData>(
    createEmptyManualLine,
  );

  const handleRemoveLine = async ({ lineId }: { lineId: number }) => {
    if (!selectedRcti) return;

    try {
      setDeletingLineId(lineId);
      const response = await fetch(
        `/api/rcti/${selectedRcti.id}/lines/${lineId}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove line");
      }

      // Clean up editedLines Map for the deleted line
      setEditedLines((prev) => {
        const newMap = new Map(prev);
        newMap.delete(lineId);
        return newMap;
      });

      const freshRctis = await fetchRctis();
      const updatedRcti = freshRctis.find((r) => r.id === selectedRcti.id);
      if (updatedRcti) {
        setSelectedRcti(updatedRcti);
      }

      toast({
        title: "Success",
        description: "Line removed successfully",
      });
    } catch (error) {
      console.error("Error removing line:", error);
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

  const fetchAvailableJobsForRcti = async ({ rcti }: { rcti: Rcti }) => {
    try {
      const response = await fetch(`/api/rcti/${rcti.id}/available-jobs`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch available jobs");
      }
      setAvailableJobs(await response.json());
    } catch (error) {
      console.error("Error fetching available jobs:", error);
      setAvailableJobs([]);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch available jobs",
        variant: "destructive",
      });
    }
  };

  const handleAddJobs = async () => {
    if (!selectedRcti || selectedJobsToAdd.length === 0) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti/${selectedRcti.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: selectedJobsToAdd }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add jobs");
      }

      const freshRctis = await fetchRctis();
      const updatedRcti = freshRctis.find((r) => r.id === selectedRcti.id);
      if (updatedRcti) {
        setSelectedRcti(updatedRcti);
        fetchAvailableJobsForRcti({ rcti: updatedRcti });
      }

      setSelectedJobsToAdd([]);
      setShowAddJobDialog(false);

      toast({
        title: "Success",
        description: `${selectedJobsToAdd.length} job(s) added successfully`,
      });
    } catch (error) {
      console.error("Error adding jobs:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add jobs",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const closeAddJobDialog = () => {
    setShowAddJobDialog(false);
    setSelectedJobsToAdd([]);
  };

  const handleAddManualLine = async () => {
    if (!selectedRcti) return;

    const { jobDate, customer, truckType, chargedHours, ratePerHour } =
      manualLineData;

    if (
      !jobDate ||
      !customer.trim() ||
      !truckType.trim() ||
      !chargedHours ||
      !ratePerHour
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti/${selectedRcti.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualLine: manualLineData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add manual line");
      }

      const freshRctis = await fetchRctis();
      const updatedRcti = freshRctis.find((r) => r.id === selectedRcti.id);
      if (updatedRcti) {
        setSelectedRcti(updatedRcti);
      }

      setIsAddingManualLine(false);
      setManualLineData(createEmptyManualLine());

      toast({
        title: "Success",
        description: "Manual line added successfully",
      });
    } catch (error) {
      console.error("Error adding manual line:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add manual line",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelManualLine = () => {
    setIsAddingManualLine(false);
    setManualLineData(createEmptyManualLine());
  };

  const handleLineEdit = ({
    lineId,
    field,
    value,
  }: {
    lineId: number;
    field: RctiLineEditField;
    value: number | string;
  }) => {
    // Allow empty strings for inputs, they'll be validated on save
    setEditedLines((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(lineId) || {};
      newMap.set(lineId, { ...existing, [field]: value });
      return newMap;
    });
  };

  return {
    editedLines,
    setEditedLines,
    deletingLineId,
    availableJobs,
    setAvailableJobs,
    showAddJobDialog,
    setShowAddJobDialog,
    selectedJobsToAdd,
    setSelectedJobsToAdd,
    isAddingManualLine,
    setIsAddingManualLine,
    manualLineData,
    setManualLineData,
    handleRemoveLine,
    fetchAvailableJobsForRcti,
    handleAddJobs,
    closeAddJobDialog,
    handleAddManualLine,
    handleCancelManualLine,
    handleLineEdit,
  };
}

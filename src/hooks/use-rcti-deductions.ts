import { useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { PendingDeductionsSummary, RctiDeduction } from "@/lib/types";

/**
 * The RCTI or jobs report whose driver's deductions are shown.
 */
export type SelectedDeductionDocument = {
  id: number;
  driverId: number;
  weekEnding: string;
};

const EMPTY_DEDUCTIONS: RctiDeduction[] = [];

export type RctiDeductionFormData = {
  type: string;
  description: string;
  totalAmount: string;
  frequency: string;
  amountPerCycle: string;
  startDate: string;
  notes: string;
};

/**
 * Returns a blank deduction form starting today.
 */
export function createEmptyDeductionForm(): RctiDeductionFormData {
  return {
    type: "deduction",
    description: "",
    totalAmount: "",
    frequency: "weekly",
    amountPerCycle: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  };
}

/**
 * Loads and manages the deductions and reimbursements for the driver of the
 * selected RCTI or jobs report, the pending deductions preview and any
 * adjustments for that document. Deductions are shared by both documents.
 */
export function useRctiDeductions({
  selectedDocument,
  setIsSaving,
}: {
  selectedDocument: SelectedDeductionDocument | null;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
}) {
  const queryClient = useQueryClient();
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionFormData, setDeductionFormData] =
    useState<RctiDeductionFormData>(createEmptyDeductionForm);
  // Pending deduction adjustments for this RCTI (deductionId -> adjusted amount or null to skip)
  const [pendingDeductionAdjustments, setPendingDeductionAdjustments] =
    useState<Map<number, number | null>>(new Map());
  const [editingDeduction, setEditingDeduction] =
    useState<RctiDeduction | null>(null);

  // Clear adjustments when switching documents (only when the ID changes)
  const selectedDocumentId = selectedDocument?.id ?? null;
  const [adjustmentsDocumentId, setAdjustmentsDocumentId] =
    useState(selectedDocumentId);
  if (adjustmentsDocumentId !== selectedDocumentId) {
    setAdjustmentsDocumentId(selectedDocumentId);
    setPendingDeductionAdjustments(new Map());
  }

  const driverId = selectedDocument?.driverId ?? 0;
  const weekEnding = selectedDocument
    ? new Date(selectedDocument.weekEnding).toISOString()
    : "";

  const deductionsQuery = useQuery({
    queryKey: queryKeys.rctiDeductions.forDriver({ driverId }),
    queryFn: async () => {
      try {
        const data = await fetchJson<RctiDeduction[]>({
          url: `/api/rcti-deductions?driverId=${driverId}`,
          fallbackMessage: "Failed to fetch deductions",
        });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching deductions:", error);
        throw error;
      }
    },
    enabled: selectedDocument !== null,
  });

  const pendingDeductionsQuery = useQuery({
    queryKey: queryKeys.rctiDeductions.pending({ driverId, weekEnding }),
    queryFn: async () => {
      try {
        return await fetchJson<PendingDeductionsSummary>({
          url: `/api/rcti-deductions/pending?driverId=${driverId}&weekEnding=${weekEnding}`,
          fallbackMessage: "Failed to fetch pending deductions",
        });
      } catch (error) {
        console.error("Error fetching pending deductions:", error);
        throw error;
      }
    },
    enabled: selectedDocument !== null,
  });

  const deductions =
    selectedDocument && deductionsQuery.data
      ? deductionsQuery.data
      : EMPTY_DEDUCTIONS;
  const pendingDeductions =
    selectedDocument && pendingDeductionsQuery.data
      ? pendingDeductionsQuery.data
      : null;
  const isLoadingDeductions =
    deductionsQuery.isLoading || pendingDeductionsQuery.isLoading;

  /** Refetch the selected driver's deductions and the pending preview. */
  const refreshDeductions = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.rctiDeductions.all });

  const handleCreateDeduction = async () => {
    if (!selectedDocument) {
      toast({
        title: "Error",
        description: "Please select an RCTI or jobs report first",
        variant: "destructive",
      });
      return;
    }

    if (!deductionFormData.description || !deductionFormData.totalAmount) {
      toast({
        title: "Validation Error",
        description: "Description and total amount are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/rcti-deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedDocument.driverId,
          type: deductionFormData.type,
          description: deductionFormData.description,
          totalAmount: parseFloat(deductionFormData.totalAmount),
          frequency: deductionFormData.frequency,
          amountPerCycle:
            deductionFormData.frequency !== "once"
              ? parseFloat(deductionFormData.amountPerCycle || "0")
              : undefined,
          startDate: deductionFormData.startDate,
          notes: deductionFormData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create deduction");
      }

      await refreshDeductions();

      setDeductionFormData(createEmptyDeductionForm());
      setShowDeductionForm(false);

      toast({
        title: "Success",
        description: "Deduction created successfully",
      });
    } catch (error) {
      console.error("Error creating deduction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create deduction",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDeduction = async () => {
    if (!editingDeduction || !selectedDocument) return;

    try {
      setIsSaving(true);
      const response = await fetch(
        `/api/rcti-deductions/${editingDeduction.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: deductionFormData.description,
            frequency: deductionFormData.frequency,
            amountPerCycle:
              deductionFormData.frequency !== "once" &&
              deductionFormData.amountPerCycle
                ? parseFloat(deductionFormData.amountPerCycle)
                : null,
            startDate: deductionFormData.startDate,
            notes: deductionFormData.notes || null,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update deduction");
      }

      await refreshDeductions();

      setEditingDeduction(null);
      setDeductionFormData(createEmptyDeductionForm());

      toast({
        title: "Success",
        description: "Deduction updated successfully",
      });
    } catch (error) {
      console.error("Error updating deduction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update deduction",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDeduction = async ({
    deductionId,
  }: {
    deductionId: number;
  }) => {
    const deduction = deductions.find((d) => d.id === deductionId);
    const hasApplications = deduction && deduction.amountPaid > 0;

    const confirmMessage = hasApplications
      ? "This deduction has been partially applied. Deleting it will cancel future applications but preserve the payment history. Continue?"
      : "Are you sure you want to delete this deduction?";

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti-deductions/${deductionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete deduction");
      }

      const result = await response.json();

      if (selectedDocument) {
        await refreshDeductions();
      }

      toast({
        title: "Success",
        description:
          result.message === "Deduction cancelled"
            ? "Deduction cancelled successfully"
            : "Deduction deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting deduction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete deduction",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingDeduction = ({
    deduction,
  }: {
    deduction: RctiDeduction;
  }) => {
    setEditingDeduction(deduction);
    setDeductionFormData({
      type: deduction.type,
      description: deduction.description,
      totalAmount: deduction.totalAmount.toString(),
      frequency: deduction.frequency,
      amountPerCycle: deduction.amountPerCycle
        ? deduction.amountPerCycle.toString()
        : "",
      startDate: format(new Date(deduction.startDate), "yyyy-MM-dd"),
      notes: deduction.notes || "",
    });
  };

  const cancelEditingDeduction = () => {
    setEditingDeduction(null);
    setDeductionFormData(createEmptyDeductionForm());
  };

  return {
    isLoadingDeductions,
    deductions,
    pendingDeductions,
    showDeductionForm,
    setShowDeductionForm,
    deductionFormData,
    setDeductionFormData,
    pendingDeductionAdjustments,
    setPendingDeductionAdjustments,
    editingDeduction,
    refreshDeductions,
    handleCreateDeduction,
    handleUpdateDeduction,
    handleDeleteDeduction,
    startEditingDeduction,
    cancelEditingDeduction,
  };
}

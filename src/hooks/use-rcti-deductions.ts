/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type {
  PendingDeductionsSummary,
  Rcti,
  RctiDeduction,
} from "@/lib/types";

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
 * Loads and manages the deductions and reimbursements for the selected RCTI's
 * driver, the pending deductions preview and any per-RCTI adjustments.
 */
export function useRctiDeductions({
  selectedRcti,
  setIsSaving,
}: {
  selectedRcti: Rcti | null;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
}) {
  const [isLoadingDeductions, setIsLoadingDeductions] = useState(false);
  const [deductions, setDeductions] = useState<RctiDeduction[]>([]);
  const [pendingDeductions, setPendingDeductions] =
    useState<PendingDeductionsSummary | null>(null);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionFormData, setDeductionFormData] =
    useState<RctiDeductionFormData>(createEmptyDeductionForm);
  // Pending deduction adjustments for this RCTI (deductionId -> adjusted amount or null to skip)
  const [pendingDeductionAdjustments, setPendingDeductionAdjustments] =
    useState<Map<number, number | null>>(new Map());
  const [editingDeduction, setEditingDeduction] =
    useState<RctiDeduction | null>(null);

  const fetchDeductionsForRcti = async ({ rcti }: { rcti: Rcti }) => {
    setIsLoadingDeductions(true);
    try {
      const response = await fetch(
        `/api/rcti-deductions?driverId=${rcti.driverId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch deductions");
      const data = await response.json();
      setDeductions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching deductions:", error);
    } finally {
      setIsLoadingDeductions(false);
    }
  };

  const fetchPendingDeductionsForRcti = async ({ rcti }: { rcti: Rcti }) => {
    setIsLoadingDeductions(true);
    try {
      const weekEnd = new Date(rcti.weekEnding);
      console.log("Fetching pending deductions for:", {
        driverId: rcti.driverId,
        weekEnding: weekEnd.toISOString(),
        rctiId: rcti.id,
      });
      const response = await fetch(
        `/api/rcti-deductions/pending?driverId=${rcti.driverId}&weekEnding=${weekEnd.toISOString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch pending deductions");
      const data = await response.json();
      console.log("Pending deductions response:", data);
      console.log("Number of pending deductions:", data?.pending?.length || 0);
      setPendingDeductions(data);
    } catch (error) {
      console.error("Error fetching pending deductions:", error);
    } finally {
      setIsLoadingDeductions(false);
    }
  };

  useEffect(() => {
    if (selectedRcti) {
      fetchDeductionsForRcti({ rcti: selectedRcti });
      fetchPendingDeductionsForRcti({ rcti: selectedRcti });
      // Clear adjustments when switching RCTIs (only when ID changes)
      setPendingDeductionAdjustments(new Map());
    } else {
      setDeductions([]);
      setPendingDeductions(null);
      setPendingDeductionAdjustments(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRcti?.id]);

  const handleCreateDeduction = async () => {
    if (!selectedRcti) {
      toast({
        title: "Error",
        description: "Please select an RCTI first",
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
          driverId: selectedRcti.driverId,
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

      await fetchDeductionsForRcti({ rcti: selectedRcti });
      await fetchPendingDeductionsForRcti({ rcti: selectedRcti });

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
    if (!editingDeduction || !selectedRcti) return;

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

      await fetchDeductionsForRcti({ rcti: selectedRcti });
      await fetchPendingDeductionsForRcti({ rcti: selectedRcti });

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

      if (selectedRcti) {
        await fetchDeductionsForRcti({ rcti: selectedRcti });
        await fetchPendingDeductionsForRcti({ rcti: selectedRcti });
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
    fetchDeductionsForRcti,
    fetchPendingDeductionsForRcti,
    handleCreateDeduction,
    handleUpdateDeduction,
    handleDeleteDeduction,
    startEditingDeduction,
    cancelEditingDeduction,
  };
}

import { useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "@/hooks/use-toast";
import type { Rcti } from "@/lib/types";

/**
 * Status and lifecycle actions for RCTIs: finalise, unfinalise, mark as paid,
 * delete and toggle the sent flag.
 */
export function useRctiStatusActions({
  selectedRcti,
  setSelectedRcti,
  setRctis,
  fetchRctis,
  setIsSaving,
  pendingDeductionAdjustments,
  setPendingDeductionAdjustments,
}: {
  selectedRcti: Rcti | null;
  setSelectedRcti: Dispatch<SetStateAction<Rcti | null>>;
  setRctis: Dispatch<SetStateAction<Rcti[]>>;
  fetchRctis: () => Promise<Rcti[]>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  pendingDeductionAdjustments: Map<number, number | null>;
  setPendingDeductionAdjustments: Dispatch<
    SetStateAction<Map<number, number | null>>
  >;
}) {
  const [isFinalising, setIsFinalising] = useState(false);

  const handleFinalizeRcti = async () => {
    if (!selectedRcti) return;

    setIsFinalising(true);
    try {
      // Convert adjustments Map to object
      const deductionOverrides: { [key: number]: number | null } = {};
      for (const [key, value] of pendingDeductionAdjustments) {
        deductionOverrides[key] = value;
      }

      const response = await fetch(`/api/rcti/${selectedRcti.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deductionOverrides:
            Object.keys(deductionOverrides).length > 0
              ? deductionOverrides
              : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to finalize RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

      // Clear adjustments after successful finalization
      setPendingDeductionAdjustments(new Map());

      toast({
        title: "Success",
        description: "RCTI finalised successfully",
      });
    } catch (error) {
      console.error("Error finalizing RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to finalise RCTI",
        variant: "destructive",
      });
    } finally {
      setIsFinalising(false);
    }
  };

  const handleUnfinalizeRcti = async () => {
    if (!selectedRcti) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/unfinalize`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unfinalize RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI reverted to draft",
      });
    } catch (error) {
      console.error("Error unfinalizing RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to unfinalise RCTI",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedRcti) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/pay`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark RCTI as paid");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI marked as paid",
      });
    } catch (error) {
      console.error("Error marking RCTI as paid:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to mark RCTI as paid",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRcti = async () => {
    if (!selectedRcti) return;

    if (
      !confirm(
        "Are you sure you want to delete this RCTI? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete RCTI");
      }

      setSelectedRcti(null);
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete RCTI",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSent = async ({ rcti }: { rcti: Rcti }) => {
    try {
      const newSentAt = rcti.sentAt ? null : new Date().toISOString();
      const response = await fetch(`/api/rcti/${rcti.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentAt: newSentAt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update sent status");
      }

      const updatedRcti = await response.json();

      setRctis((prev) =>
        prev.map((r) =>
          r.id === rcti.id ? { ...r, sentAt: updatedRcti.sentAt } : r,
        ),
      );

      if (selectedRcti?.id === rcti.id) {
        setSelectedRcti({ ...selectedRcti, sentAt: updatedRcti.sentAt });
      }

      toast({
        title: "Success",
        description: newSentAt
          ? "RCTI marked as sent"
          : "RCTI marked as unsent",
      });
    } catch (error) {
      console.error("Error toggling sent status:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update sent status",
        variant: "destructive",
      });
    }
  };


  return {
    isFinalising,
    handleFinalizeRcti,
    handleUnfinalizeRcti,
    handleMarkAsPaid,
    handleDeleteRcti,
    handleToggleSent,
  };
}

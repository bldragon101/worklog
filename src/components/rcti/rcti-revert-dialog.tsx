"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Rcti } from "@/lib/types";

export interface RctiRevertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rcti: Rcti | null;
  onReverted: ({ rcti }: { rcti: Rcti }) => Promise<void>;
}

/**
 * Confirms reverting a paid RCTI to draft, recording the reason given.
 */
export function RctiRevertDialog({
  open,
  onOpenChange,
  rcti,
  onReverted,
}: RctiRevertDialogProps) {
  const [revertReason, setRevertReason] = useState("");
  const [isReverting, setIsReverting] = useState(false);

  const handleRevertToDraft = async () => {
    if (!rcti || !revertReason.trim()) return;

    setIsReverting(true);
    try {
      const response = await fetch(`/api/rcti/${rcti.id}/revert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: revertReason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to revert RCTI to draft");
      }

      const updatedRcti = await response.json();
      await onReverted({ rcti: updatedRcti });

      toast({
        title: "Success",
        description: "RCTI reverted to draft successfully",
      });

      onOpenChange(false);
      setRevertReason("");
    } catch (error) {
      console.error("Error reverting RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to revert RCTI to draft",
        variant: "destructive",
      });
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revert RCTI to Draft</DialogTitle>
          <DialogDescription>
            This will revert the paid RCTI back to draft status. Please provide
            a reason for this change, which will be recorded and shown on the
            PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="revert-reason">
              Reason for Reverting <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="revert-reason"
              placeholder="e.g., Payment cancelled, incorrect amount, etc."
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            {revertReason.trim().length < 5 && revertReason.length > 0 && (
              <p className="text-sm text-destructive">
                Reason must be at least 5 characters
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            id="cancel-revert-btn"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setRevertReason("");
            }}
            disabled={isReverting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            id="confirm-revert-btn"
            onClick={handleRevertToDraft}
            disabled={isReverting || revertReason.trim().length < 5}
          >
            {isReverting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Reverting...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Revert to Draft
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

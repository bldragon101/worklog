"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { formatStatementDate } from "@/lib/rcti-statement";
import type { Rcti } from "@/lib/types";
import { CheckCircle } from "lucide-react";

interface RctiMarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Finalised RCTIs to mark as paid */
  rctis: Rcti[];
  /** Number of selected RCTIs that are already paid and will be left as they are */
  alreadyPaidCount: number;
  onPaid: ({ paidCount }: { paidCount: number }) => Promise<void> | void;
}

/** Confirms and marks a set of finalised RCTIs as paid in one batch */
export function RctiMarkPaidDialog({
  open,
  onOpenChange,
  rctis,
  alreadyPaidCount,
  onPaid,
}: RctiMarkPaidDialogProps) {
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);

  const total = rctis.reduce((sum, r) => sum + Number(r.total), 0);
  const sortedRctis = [...rctis].sort((a, b) =>
    a.weekEnding.slice(0, 10).localeCompare(b.weekEnding.slice(0, 10)),
  );
  const countLabel = `${rctis.length} RCTI${rctis.length === 1 ? "" : "s"}`;

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPaying) return;
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    setIsPaying(true);
    try {
      const response = await fetch("/api/rcti/pay-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rctis.map(({ id }) => id) }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to mark RCTIs as paid");
      }

      const result = await response.json();
      const paidCount = Number(result.paidCount) || 0;
      const skippedCount = Array.isArray(result.skipped)
        ? result.skipped.length
        : 0;
      const paidLabel = `Marked ${paidCount} RCTI${paidCount === 1 ? "" : "s"} as paid`;

      toast({
        title: skippedCount > 0 ? "Partially Successful" : "Success",
        description:
          skippedCount > 0 ? `${paidLabel}. ${skippedCount} skipped.` : paidLabel,
      });

      await onPaid({ paidCount });
      onOpenChange(false);
    } catch (error) {
      console.error("Error marking RCTIs as paid:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to mark RCTIs as paid",
        variant: "destructive",
      });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <DialogTitle>Mark {countLabel} as Paid</DialogTitle>
          </div>
          <DialogDescription>
            Records today as the paid date for each RCTI below.
            {alreadyPaidCount > 0 &&
              ` ${alreadyPaidCount} selected RCTI${alreadyPaidCount === 1 ? " is" : "s are"} already paid and will be left as ${alreadyPaidCount === 1 ? "it is" : "they are"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-48 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">RCTIs to mark as paid</caption>
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">
                  Invoice
                </th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">
                  Week Ending
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Payable
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRctis.map((rcti) => (
                <tr key={rcti.id} className="border-t">
                  <td className="px-3 py-1.5 font-medium">
                    {rcti.invoiceNumber}
                  </td>
                  <td className="px-3 py-1.5">
                    {formatStatementDate({ isoString: rcti.weekEnding })}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {formatCurrency({ amount: Number(rcti.total) })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-semibold">
                <td className="px-3 py-1.5" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-1.5 text-right">
                  {formatCurrency({ amount: total })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPaying}
            id="cancel-mark-paid-btn"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPaying || rctis.length === 0}
            id="confirm-mark-paid-btn"
          >
            {isPaying ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            {isPaying ? "Marking..." : "Mark as Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DeleteInvoiceDialogProps {
  open: boolean;
  reference: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Confirms deleting a saved invoice, explaining its jobs go back to the draft */
export function DeleteInvoiceDialog({
  open,
  reference,
  isPending,
  onOpenChange,
  onConfirm,
}: DeleteInvoiceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent id="delete-invoice-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete invoice {reference}?</AlertDialogTitle>
          <AlertDialogDescription>
            The saved invoice is deleted and its jobs return to the automatic draft
            for this customer and week. The jobs themselves are not changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel id="cancel-delete-invoice-btn" disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            id="confirm-delete-invoice-btn"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete invoice"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

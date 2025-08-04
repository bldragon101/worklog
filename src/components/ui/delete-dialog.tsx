"use client";

import { AlertTriangle } from "lucide-react";
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

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  isLoading?: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description,
  itemName,
  isLoading = false,
}: DeleteDialogProps) {
  const defaultDescription = itemName
    ? `This action cannot be undone. This will permanently delete "${itemName}" and remove all associated data from our servers.`
    : "This action cannot be undone. This will permanently delete the item and remove all associated data from our servers.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent id="delete-confirmation-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            id="cancel-delete-btn"
            disabled={isLoading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            id="confirm-delete-btn"
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProgressDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ProgressDialog({
  open,
  title = "Processing...",
  description = "Please wait while we process your request.",
  icon = <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />,
}: ProgressDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent id="progress-dialog" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            {icon}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Working...</span>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

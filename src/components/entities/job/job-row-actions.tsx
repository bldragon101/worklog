"use client";

import React, { useState } from "react";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Paperclip,
  Copy,
  Clipboard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Job } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  JobCopyDetailsDialog,
  formatJobDetails,
} from "./job-copy-details-dialog";

interface JobRowActionsProps {
  row: Job;
  onEdit?: (job: Job) => void | Promise<void>;
  onDelete?: (job: Job) => void | Promise<void>;
  onAttach?: (job: Job) => void;
  onDuplicate?: (job: Job) => void;
}

export function JobRowActions({
  row,
  onEdit,
  onDelete,
  onAttach,
  onDuplicate,
}: JobRowActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(row));
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Delete failed:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete the job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async () => {
    if (!onEdit) return;

    try {
      await Promise.resolve(onEdit(row));
    } catch (error) {
      console.error("Edit failed:", error);
      toast({
        title: "Edit failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to open the job for editing. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = () => {
    if (!onDuplicate) return;

    try {
      onDuplicate(row);
    } catch (error) {
      console.error("Duplicate failed:", error);
      toast({
        title: "Duplicate failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to duplicate the job. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAttach = () => {
    if (!onAttach) return;

    try {
      onAttach(row);
    } catch (error) {
      console.error("Attach failed:", error);
      toast({
        title: "Attach failed",
        description: "Failed to open attachment dialog. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyDetails = async () => {
    try {
      const formattedDetails = formatJobDetails(row);
      await navigator.clipboard.writeText(formattedDetails);

      toast({
        title: "Copied to clipboard",
        description: "Job details have been copied to your clipboard.",
        variant: "default",
      });

      setShowCopyDialog(false);
    } catch (error) {
      console.error("Copy failed:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy job details. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyMenuItem = () => {
    setShowCopyDialog(true);
  };

  const getJobName = () => {
    return `${new Date(row.date).toLocaleDateString()} - ${row.customer} (${row.driver})`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
          id={`job-actions-${row.id}`}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={handleCopyMenuItem}
          id={`copy-details-${row.id}`}
        >
          <Clipboard className="mr-2 h-4 w-4" />
          Copy Details
        </DropdownMenuItem>
        {onAttach && (
          <DropdownMenuItem
            onClick={handleAttach}
            id={`attach-files-${row.id}`}
          >
            <Paperclip className="mr-2 h-4 w-4" />
            Attach Files
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={handleEdit} id={`edit-job-${row.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem
            onClick={handleDuplicate}
            id={`duplicate-job-${row.id}`}
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
            id={`delete-job-${row.id}`}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Job"
        description="Are you sure you want to delete this job? This action cannot be undone."
        itemName={getJobName()}
        isLoading={isDeleting}
      />

      <JobCopyDetailsDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        job={row}
        onCopy={handleCopyDetails}
      />
    </DropdownMenu>
  );
}

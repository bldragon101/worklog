"use client";

import React, { useState } from "react";
import { MoreHorizontal, Edit, Trash2, Paperclip, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Job } from "@/lib/types";

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
  const [isDeleting, setIsDeleting] = useState(false);
  

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(row));
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
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
        {onAttach && (
          <DropdownMenuItem onClick={() => onAttach(row)} id={`attach-files-${row.id}`}>
            <Paperclip className="mr-2 h-4 w-4" />
            Attach Files
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(row)} id={`edit-job-${row.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onClick={() => onDuplicate(row)} id={`duplicate-job-${row.id}`}>
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
    </DropdownMenu>
  );
}
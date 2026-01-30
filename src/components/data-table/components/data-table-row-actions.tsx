"use client";

import { useState, ReactNode } from "react";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteDialog } from "@/components/ui/delete-dialog";

interface CustomAction<TData> {
  label: string;
  icon?: ReactNode;
  onClick: (data: TData) => void | Promise<void>;
  variant?: "default" | "destructive";
}

interface DataTableRowActionsProps<TData> {
  row: TData;
  onEdit?: (data: TData) => void | Promise<void>;
  onDelete?: (data: TData) => void | Promise<void>;
  getItemName?: (data: TData) => string;
  deleteTitle?: string;
  deleteDescription?: string;
  customActions?: CustomAction<TData>[];
}

export function DataTableRowActions<TData>({
  row,
  onEdit,
  onDelete,
  getItemName,
  deleteTitle,
  deleteDescription,
  customActions,
}: DataTableRowActionsProps<TData>) {
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

  const handleCustomAction = async (action: CustomAction<TData>) => {
    try {
      await Promise.resolve(action.onClick(row));
    } catch (error) {
      console.error("Action failed:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="row-actions-trigger"
          type="button"
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {onEdit && (
          <DropdownMenuItem
            id="row-action-edit"
            onClick={() => onEdit(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onEdit(row);
              }
            }}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {customActions && customActions.length > 0 && (
          <>
            {onEdit && <DropdownMenuSeparator />}
            {customActions.map((action, index) => (
              <DropdownMenuItem
                key={`custom-action-${index}`}
                id={`row-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => handleCustomAction(action)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleCustomAction(action);
                  }
                }}
                className={
                  action.variant === "destructive"
                    ? "text-destructive focus:text-destructive"
                    : undefined
                }
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {onDelete && (
          <>
            {(onEdit || (customActions && customActions.length > 0)) && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              id="row-action-delete"
              onClick={() => setShowDeleteDialog(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setShowDeleteDialog(true);
                }
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      <DeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title={deleteTitle}
        description={deleteDescription}
        itemName={getItemName ? getItemName(row) : undefined}
        isLoading={isDeleting}
      />
    </DropdownMenu>
  );
}

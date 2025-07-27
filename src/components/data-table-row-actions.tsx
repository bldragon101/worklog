"use client"

import { DotsHorizontalIcon } from "@radix-ui/react-icons"
import { Loader2 } from "lucide-react"
import { Row } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableRowActionsProps<TData extends { id: number | string }> {
  row: Row<TData>
  onEdit: (row: TData) => void
  onDelete: (row: TData) => void
  isLoading?: boolean
  loadingRowId?: number | string | null
}

export function DataTableRowActions<TData extends { id: number | string }>({
  row,
  onEdit,
  onDelete,
  isLoading = false,
  loadingRowId = null,
}: DataTableRowActionsProps<TData>) {
  const isRowLoading = isLoading && loadingRowId === row.original.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
          disabled={isRowLoading}
        >
          {isRowLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DotsHorizontalIcon className="h-4 w-4" />
          )}
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem 
          onClick={() => !isRowLoading && onEdit(row.original)}
          disabled={isRowLoading}
        >
          {isRowLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : (
            "Edit"
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => !isRowLoading && onDelete(row.original)}
          disabled={isRowLoading}
        >
          {isRowLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : (
            "Delete"
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu"
import { MixerHorizontalIcon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  // Track column visibility state locally to avoid stale state issues
  const [localColumnVisibility, setLocalColumnVisibility] = useState(() => table.getState().columnVisibility || {});
  
  // Sync local state with table state on mount and when table changes
  useEffect(() => {
    const tableState = table.getState().columnVisibility || {};
    setLocalColumnVisibility(tableState);
  }, [table]);
  
  const allColumns = table.getAllColumns();
  const columns = allColumns.filter(
    (column) =>
      (typeof column.accessorFn !== "undefined" || column.accessorKey) && 
      column.getCanHide() &&
      column.id && 
      column.id.trim() !== ""
  );
  
  // Use local state for visibility
  const columnVisibility = localColumnVisibility;
  const visibilityKey = JSON.stringify(columnVisibility);
  


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <MixerHorizontalIcon className="mr-2 h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]" key={visibilityKey}>
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          // Read visibility from table state directly instead of column.getIsVisible()
          const isVisible = columnVisibility ? columnVisibility[column.id] !== false : true;
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={isVisible}
              onCheckedChange={(value) => {
                // Update both table state and local state immediately
                // Include all existing columns in the new state to maintain consistency
                const allColumnIds = columns.reduce((acc, col) => {
                  acc[col.id] = localColumnVisibility[col.id] !== false;
                  return acc;
                }, {} as Record<string, boolean>);
                
                const newState = { ...allColumnIds, [column.id]: !!value };
                
                try {
                  // Update table state
                  table.setColumnVisibility(newState);
                  
                  // Update local state immediately for UI responsiveness
                  setLocalColumnVisibility(newState);
                } catch (error) {
                  console.error('Failed to update column visibility:', error);
                  // Keep local state in sync even if table update fails
                  setLocalColumnVisibility(newState);
                }
              }}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 
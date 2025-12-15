"use client";

import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  const allColumns = table.getAllColumns();
  const columns = allColumns.filter(
    (column) => column.getCanHide() && column.id && column.id.trim() !== "",
  );

  // Use local state initialized from table state for immediate UI updates
  const [localColumnVisibility, setLocalColumnVisibility] = useState(
    () => table.getState().columnVisibility || {},
  );

  // Get current table state for comparison
  const tableColumnVisibility = table.getState().columnVisibility || {};
  const tableVisibilityKey = JSON.stringify(tableColumnVisibility);

  // Sync local state when table state changes externally
  // This is a legitimate pattern for syncing with external state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalColumnVisibility(table.getState().columnVisibility || {});
  }, [tableVisibilityKey, table]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          // Sync local state with table state when dropdown opens
          setLocalColumnVisibility(table.getState().columnVisibility || {});
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          id="view-columns-btn"
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 md:flex rounded"
          aria-label="View columns"
        >
          <MixerHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[150px]"
        key={tableVisibilityKey}
      >
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const isVisible = localColumnVisibility[column.id] !== false;
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={isVisible}
              onCheckedChange={(value) => {
                // Build complete new state with updated column
                const allColumnIds = columns.reduce(
                  (acc, col) => {
                    acc[col.id] = localColumnVisibility[col.id] !== false;
                    return acc;
                  },
                  {} as Record<string, boolean>,
                );

                const newState = { ...allColumnIds, [column.id]: !!value };

                // Update local state immediately for instant UI feedback
                setLocalColumnVisibility(newState);

                // Update table state
                try {
                  table.setColumnVisibility(newState);
                } catch (error) {
                  console.error("Failed to update column visibility:", error);
                }
              }}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

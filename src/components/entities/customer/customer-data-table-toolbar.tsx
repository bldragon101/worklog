"use client";

import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import { useState } from "react";
import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CsvImportExport } from "@/components/shared/csv-import-export";
import { useSearch } from "@/contexts/search-context";

interface CustomerDataTableToolbarProps<TData> {
  table: Table<TData>;
  onImportSuccess?: () => void;
  onAddCustomer?: () => void;
  filters?: {
    customer?: string;
    billTo?: string;
  };
}

export function CustomerDataTableToolbar<TData>({
  table,
  onImportSuccess,
  onAddCustomer,
  filters,
}: CustomerDataTableToolbarProps<TData>) {
  const { globalSearchValue } = useSearch();
  const [localColumnVisibility, setLocalColumnVisibility] = useState<
    Record<string, boolean>
  >({});

  // Apply global search to table
  React.useEffect(() => {
    table.setGlobalFilter(globalSearchValue);
  }, [globalSearchValue, table]);

  // Initialize local column visibility state
  React.useEffect(() => {
    const initialVisibility: Record<string, boolean> = {};
    table.getAllColumns().forEach((column) => {
      if (column.getCanHide()) {
        initialVisibility[column.id] = column.getIsVisible();
      }
    });
    setLocalColumnVisibility(initialVisibility);
  }, [table]);

  const handleColumnToggle = (columnId: string, value: boolean) => {
    const column = table.getColumn(columnId);
    if (column) {
      column.toggleVisibility(value);
      setLocalColumnVisibility((prev) => ({
        ...prev,
        [columnId]: value,
      }));
    }
  };

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-end gap-2">
        <CsvImportExport
          type="customers"
          onImportSuccess={onImportSuccess}
          filters={filters}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 rounded">
              <MixerHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" &&
                  column.getCanHide(),
              )
              .map((column) => {
                const isVisible =
                  localColumnVisibility[column.id] ?? column.getIsVisible();
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={isVisible}
                    onCheckedChange={(value) =>
                      handleColumnToggle(column.id, !!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        {onAddCustomer && (
          <Button
            id="add-customer-btn"
            onClick={onAddCustomer}
            className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 h-8 min-w-0 sm:w-auto rounded"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">Add Customer</span>
            <span className="xs:hidden">Add</span>
          </Button>
        )}
      </div>
    </div>
  );
}

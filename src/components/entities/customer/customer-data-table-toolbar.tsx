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
    <div className="bg-white dark:bg-background px-4 pb-3 pt-3 border-b">
      <div className="flex flex-wrap items-center gap-2 justify-between min-h-[2rem]">
        {/* Left side: Filters (placeholder for future filters) */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {/* Future filters will go here */}
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
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
          </div>
          <div className="sm:hidden flex items-center gap-2">
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
            <CsvImportExport
              type="customers"
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
          </div>
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
    </div>
  );
}

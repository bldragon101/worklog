"use client";

import { Table } from "@tanstack/react-table";
import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options";
import { CsvImportExportDropdown } from "@/components/shared/csv-import-export-dropdown";
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

  // Apply global search to table
  React.useEffect(() => {
    table.setGlobalFilter(globalSearchValue);
  }, [globalSearchValue, table]);

  const isFiltered = table.getState().columnFilters.length > 0;

  const handleReset = () => {
    table.resetColumnFilters();
  };

  const selectedRows = table.getSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;
  const onMultiDelete = table.options.onMultiDelete as
    | ((rows: TData[]) => void)
    | undefined;

  return (
    <div className="bg-white dark:bg-background px-4 pb-3 pt-3 border-b">
      <div className="flex flex-wrap items-center gap-2 justify-between min-h-[2rem]">
        {/* Left side: Filters (placeholder for future filters) */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={handleReset}
              className="h-8 px-2 lg:px-3 flex-shrink-0 rounded"
              size="sm"
            >
              <span className="hidden sm:inline">Reset</span>
              <span className="sm:hidden">Reset</span>
            </Button>
          )}
          {hasSelection && onMultiDelete && (
            <Button
              id="delete-selected-customers-btn"
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 px-3 rounded"
              onClick={() => onMultiDelete(selectedRows.map((r) => r.original))}
            >
              Delete Selected
            </Button>
          )}
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
            <CsvImportExportDropdown
              type="customers"
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
            <DataTableViewOptions table={table} />
          </div>
          <div className="sm:hidden flex items-center gap-2">
            <DataTableViewOptions table={table} />
            <CsvImportExportDropdown
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

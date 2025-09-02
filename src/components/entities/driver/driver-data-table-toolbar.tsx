"use client";

import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTableFacetedFilterSimple } from "@/components/data-table/components/data-table-faceted-filter-simple";
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import * as React from "react";
import type { Driver } from "@/lib/types";
import { CsvImportExport } from "@/components/shared/csv-import-export";
import { useSearch } from "@/contexts/search-context";

interface DriverDataTableToolbarProps {
  table: Table<Driver>;
  onAddDriver?: () => void;
  onImportSuccess?: () => void;
  filters?: {
    driver?: string;
    type?: string;
  };
  isLoading?: boolean;
}

export function DriverDataTableToolbar({
  table,
  onAddDriver,
  onImportSuccess,
  filters,
  isLoading = false,
}: DriverDataTableToolbarProps) {
  const { globalSearchValue } = useSearch();
  const isFiltered = table.getState().columnFilters.length > 0;

  // Apply global search to table when globalSearchValue changes
  React.useEffect(() => {
    table.setGlobalFilter(globalSearchValue);
  }, [globalSearchValue, table]);

  const handleReset = () => {
    table.resetColumnFilters();
  };

  const driverTypeOptions = [
    {
      label: "Employee",
      value: "Employee",
    },
    {
      label: "Contractor",
      value: "Contractor",
    },
    {
      label: "Subcontractor",
      value: "Subcontractor",
    },
  ];

  return (
    <div className="px-4 pb-0 pt-3">
      <div className="flex flex-wrap items-center gap-2 justify-between min-h-[2rem]">
        {/* Left side: Filters */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            table.getColumn("type") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("type")}
                title="Type"
                options={driverTypeOptions}
              />
            )
          )}
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
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
            <CsvImportExport
              type="drivers"
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
            <DataTableViewOptions table={table} />
          </div>
          <div className="sm:hidden flex items-center gap-2">
            <DataTableViewOptions table={table} />
            <CsvImportExport
              type="drivers"
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
          </div>
          {onAddDriver && (
            <Button
              id="add-driver-btn"
              onClick={onAddDriver}
              size="sm"
              className="h-8 min-w-0 sm:w-auto rounded"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Add Driver</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

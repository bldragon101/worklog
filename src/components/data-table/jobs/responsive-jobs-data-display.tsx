"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import { ExpandableMobileCardView } from "@/components/data-table/mobile/expandable-mobile-card-view";
import type { ColumnDef, Table, OnChangeFn } from "@tanstack/react-table";
import type { SheetField } from "@/components/data-table/core/types";
import type { Job } from "@/lib/types";
import * as React from "react";
import {
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

interface MobileCardField {
  key: string;
  label: string;
  render?: (value: unknown, item: unknown) => React.ReactNode;
  className?: string;
  isBadge?: boolean;
  isTitle?: boolean;
  isSubtitle?: boolean;
  isCheckbox?: boolean;
  onCheckboxChange?: (item: unknown, value: boolean) => void;
}

interface ExpandableDetailField {
  key: string;
  label: string;
  render?: (value: unknown, item: unknown) => React.ReactNode;
  className?: string;
  isBadge?: boolean;
  hideIfEmpty?: boolean;
}

interface ResponsiveJobsDataDisplayProps {
  data: Job[];
  columns: ColumnDef<Job, unknown>[];
  mobileFields: MobileCardField[];
  expandableFields: ExpandableDetailField[];
  sheetFields?: SheetField<Job, unknown>[];
  onEdit?: (data: Job) => void;
  onDelete?: (data: Job) => void;
  onAttachFiles?: (data: Job) => void;
  isLoading?: boolean;
  loadingRowId?: number | null;
  onTableReady?: (table: Table<Job>) => void;
  getItemId?: (item: Job) => number | string;
  // External column visibility state
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
}

export function ResponsiveJobsDataDisplay({
  data,
  columns,
  mobileFields,
  expandableFields,
  sheetFields = [],
  onEdit,
  onDelete,
  onAttachFiles,
  isLoading = false,
  loadingRowId,
  onTableReady,
  getItemId,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange: externalOnColumnVisibilityChange,
}: ResponsiveJobsDataDisplayProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  // Create shared table state for both desktop and mobile views
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  
  // Initialize column visibility based on column metadata or external state
  const initialVisibility = React.useMemo(() => {
    if (externalColumnVisibility) {
      return externalColumnVisibility;
    }
    
    const visibility: VisibilityState = {};
    columns.forEach((column) => {
      if ((column.meta as { hidden?: boolean })?.hidden === true) {
        if ('accessorKey' in column && column.accessorKey) {
          visibility[column.accessorKey as string] = false;
        } else if (column.id) {
          visibility[column.id] = false;
        }
      }
    });
    return visibility;
  }, [columns, externalColumnVisibility]);

  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>(initialVisibility);
  
  // Use external state if provided, otherwise use internal state
  const columnVisibility = externalColumnVisibility || internalColumnVisibility;
  const setColumnVisibility = externalOnColumnVisibilityChange || setInternalColumnVisibility;
  
  // Create the shared table instance
  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Call onTableReady when table is ready
  React.useEffect(() => {
    if (onTableReady && table) {
      onTableReady(table);
    }
  }, [table, onTableReady]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  return (
    <>
      {/* Desktop Table View */}
      <div className={`${isMobile ? 'hidden' : 'block'}`}>
        <DataTable
          data={data}
          columns={columns}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={() => {}} // No-op since we handle this above
          tableInstance={table} // Pass the shared table instance
        />
      </div>

      {/* Mobile Expandable Card View */}
      <div className={`${isMobile ? 'block' : 'hidden'}`}>
        <ExpandableMobileCardView
          data={data}
          fields={mobileFields}
          expandableFields={expandableFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onAttachFiles={onAttachFiles}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          getItemId={getItemId}
        />
      </div>
    </>
  );
}
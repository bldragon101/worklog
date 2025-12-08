"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import { MobileCardView } from "@/components/data-table/mobile/mobile-card-view";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef, Table, OnChangeFn } from "@tanstack/react-table";
import type { SheetField } from "@/components/data-table/core/types";
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
  type RowSelectionState,
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
}

interface ResponsiveDataDisplayProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  mobileFields: MobileCardField[];
  sheetFields?: SheetField<TData, unknown>[];
  onEdit?: (data: TData) => void;
  onDelete?: (data: TData) => void;
  onMultiDelete?: (data: TData[]) => void;
  onCardClick?: (data: TData) => void;
  isLoading?: boolean;
  loadingRowId?: number | null;
  onTableReady?: (table: Table<TData>) => void;
  getItemId?: (item: TData) => number | string;
  // External column visibility state
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
}

export function ResponsiveDataDisplay<TData>({
  data,
  columns,
  mobileFields,
  sheetFields = [],
  onEdit,
  onDelete,
  onMultiDelete,
  onCardClick,
  isLoading = false,
  loadingRowId,
  onTableReady,
  getItemId,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange: externalOnColumnVisibilityChange,
}: ResponsiveDataDisplayProps<TData>) {
  const [isMobile, setIsMobile] = useState(false);

  // Create shared table state for both desktop and mobile views
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  // Initialize column visibility based on column metadata or external state
  const initialVisibility = React.useMemo(() => {
    if (externalColumnVisibility) {
      return externalColumnVisibility;
    }

    const visibility: VisibilityState = {};
    columns.forEach((column) => {
      if ((column.meta as { hidden?: boolean })?.hidden === true) {
        if ("accessorKey" in column && column.accessorKey) {
          visibility[column.accessorKey as string] = false;
        } else if (column.id) {
          visibility[column.id] = false;
        }
      }
    });
    return visibility;
  }, [columns, externalColumnVisibility]);

  const [internalColumnVisibility, setInternalColumnVisibility] =
    React.useState<VisibilityState>(initialVisibility);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Use external state if provided, otherwise use internal state
  const columnVisibility = externalColumnVisibility || internalColumnVisibility;
  const setColumnVisibility =
    externalOnColumnVisibilityChange || setInternalColumnVisibility;

  // Add selection column for multi-actions support (matching ResponsiveJobsDataDisplay logic)
  const enhancedColumns = React.useMemo(() => {
    const hasCustomSelect = columns.some((col) => col.id === "select");

    if (onMultiDelete && !hasCustomSelect) {
      const selectColumn: ColumnDef<TData, unknown> = {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center w-full h-full">
            <Checkbox
              id="select-all-checkbox"
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all rows"
              className="rounded data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center w-full h-full">
            <Checkbox
              id={`select-row-${row.id}-checkbox`}
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
        minSize: 40,
        maxSize: 60,
        meta: {
          hidden: false,
        },
      };
      return [selectColumn, ...columns];
    }

    return columns;
  }, [columns, onMultiDelete]);

  // Create the shared table instance
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: enhancedColumns,
    getRowId: (row: TData) =>
      (row as { id?: number | string }).id?.toString() || String(Math.random()),
    state: {
      columnFilters,
      globalFilter,
      sorting,
      columnVisibility,
      pagination,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
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
    window.addEventListener("resize", checkIfMobile);

    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  return (
    <>
      {/* Desktop Table View */}
      <div className={`${isMobile ? "hidden" : "flex flex-col h-full"}`}>
        <DataTable
          data={data}
          columns={enhancedColumns}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onMultiDelete={onMultiDelete}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={() => {}} // No-op since we handle this above
          tableInstance={table} // Pass the shared table instance
        />
      </div>

      {/* Mobile Card View */}
      <div className={`${isMobile ? "block" : "hidden"}`}>
        <MobileCardView
          data={data}
          fields={mobileFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onCardClick={onCardClick}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          getItemId={getItemId}
        />
      </div>
    </>
  );
}

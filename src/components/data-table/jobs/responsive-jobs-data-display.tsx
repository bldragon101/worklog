"use client";

import { DataTable } from "@/components/data-table/core/data-table";
import { MobileErrorBoundary } from "@/components/data-table/mobile/mobile-error-boundary";
import { MobileJobsView } from "./mobile-jobs-view";
import { Checkbox } from "@/components/ui/checkbox";
import { JobsDataTablePagination } from "./jobs-data-table-pagination";
import type { OnChangeFn } from "@tanstack/react-table";
import { dataTableFeatures, type DataTableColumnDef, type DataTableInstance } from "@/components/data-table/core/table-features";
import type { SheetField } from "@/components/data-table/core/types";
import type { Job } from "@/lib/types";
import * as React from "react";
import {
  useTable,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import { useNotifyTableReady } from "@/components/data-table/core/use-notify-table-ready";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsiveJobsDataDisplayProps {
  data: Job[];
  columns: DataTableColumnDef<Job, unknown>[];
  sheetFields?: SheetField<Job, unknown>[];
  onEdit?: (data: Job) => void;
  onDelete?: (data: Job) => void;
  onMultiDelete?: (data: Job[]) => void;
  onMarkAsInvoiced?: (data: Job[]) => void;
  onBulkAttachFiles?: (data: Job[]) => void;
  onAttachFiles?: (data: Job) => void;
  onDuplicate?: (data: Job) => void;
  onUpdateStatus?: (
    id: number,
    field: "runsheet" | "invoiced",
    value: boolean,
  ) => Promise<void>;
  isLoading?: boolean;
  loadingRowId?: number | null;
  onTableReady?: (table: DataTableInstance<Job>) => void;
  // External column visibility state
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>;
}

export function ResponsiveJobsDataDisplay({
  data,
  columns,
  sheetFields = [],
  onEdit,
  onDelete,
  onMultiDelete,
  onMarkAsInvoiced,
  onBulkAttachFiles,
  onAttachFiles,
  onDuplicate,
  onUpdateStatus,
  isLoading = false,
  loadingRowId,
  onTableReady,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange: externalOnColumnVisibilityChange,
}: ResponsiveJobsDataDisplayProps) {
  const isMobile = useIsMobile();

  // Create shared table state for both desktop and mobile views
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
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

    const visibility: ColumnVisibilityState = {};
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
    React.useState<ColumnVisibilityState>(initialVisibility);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Use external state if provided, otherwise use internal state
  const columnVisibility = externalColumnVisibility || internalColumnVisibility;
  const setColumnVisibility =
    externalOnColumnVisibilityChange || setInternalColumnVisibility;

  // Add selection column for multi-actions support (matching DataTable logic)
  const enhancedColumns = React.useMemo(() => {
    const hasCustomSelect = columns.some((col) => col.id === "select");

    if (
      (onMultiDelete || onMarkAsInvoiced || onBulkAttachFiles) &&
      !hasCustomSelect
    ) {
      const selectColumn: DataTableColumnDef<Job, unknown> = {
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
  }, [columns, onMultiDelete, onMarkAsInvoiced, onBulkAttachFiles]);

  // Create the shared table instance
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: enhancedColumns,
    getRowId: (row: Job) => row.id?.toString() || String(Math.random()),
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  useNotifyTableReady({ table, state: table.state, data, onTableReady });

  if (isMobile) {
    return (
      <MobileErrorBoundary fallbackMessage="There was an issue displaying the job cards. Try refreshing the page.">
        <MobileJobsView
          jobs={table
            .getPrePaginatedRowModel()
            .rows.map((row) => row.original)}
          isLoading={isLoading}
          onEdit={onEdit}
          onDelete={onDelete}
          onAttachFiles={onAttachFiles}
          onDuplicate={onDuplicate}
          onUpdateStatus={onUpdateStatus}
        />
      </MobileErrorBoundary>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DataTable
        data={data}
        columns={enhancedColumns}
        sheetFields={sheetFields}
        onEdit={onEdit}
        onDelete={onDelete}
        onMultiDelete={onMultiDelete}
        onMarkAsInvoiced={onMarkAsInvoiced}
        onBulkAttachFiles={onBulkAttachFiles}
        isLoading={isLoading}
        loadingRowId={loadingRowId}
        onTableReady={() => {}} // No-op since we handle this above
        tableInstance={table} // Pass the shared table instance
        PaginationComponent={JobsDataTablePagination}
      />
    </div>
  );
}

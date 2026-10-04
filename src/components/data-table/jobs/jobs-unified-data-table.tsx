"use client";

import * as React from "react";
import { ResponsiveJobsDataDisplay } from "./responsive-jobs-data-display";
import { MobileToolbarWrapper } from "@/components/data-table/components/mobile-toolbar-wrapper";
import type { SheetField } from "@/components/data-table/core/types";
import type {
  ColumnVisibilityState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { DataTableColumnDef, DataTableInstance } from "@/components/data-table/core/table-features";
import type { Job } from "@/lib/types";

export interface JobsUnifiedDataTableProps {
  // Data and columns
  data: Job[];
  columns: DataTableColumnDef<Job, unknown>[];
  sheetFields?: SheetField<Job, unknown>[];

  // Loading states
  isLoading?: boolean;
  loadingRowId?: number | null;

  // CRUD operations
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
  onAdd?: () => void;

  // Import/Export
  onImportSuccess?: () => void;

  // Toolbar component
  ToolbarComponent?: React.ComponentType<{
    table: DataTableInstance<Job>;
    onImportSuccess?: () => void;
    onAdd?: () => void;
    filters?: Record<string, unknown>;
    isLoading?: boolean;
    dataLength?: number;
  }>;

  // Filters
  filters?: Record<string, unknown>;

  // Column visibility
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: OnChangeFn<ColumnVisibilityState>;
}

export function JobsUnifiedDataTable({
  data,
  columns,
  sheetFields = [],
  isLoading = false,
  loadingRowId,
  onEdit,
  onDelete,
  onMultiDelete,
  onMarkAsInvoiced,
  onBulkAttachFiles,
  onAttachFiles,
  onDuplicate,
  onUpdateStatus,
  onAdd,
  onImportSuccess,
  ToolbarComponent,
  filters,
  columnVisibility,
  onColumnVisibilityChange,
}: JobsUnifiedDataTableProps) {
  const [tableInstance, setTableInstance] = React.useState<DataTableInstance<Job> | null>(
    null,
  );

  // Check if columns already contain a custom actions column
  const hasCustomActions = React.useMemo(
    () => columns.some((col) => col.id === "actions"),
    [columns],
  );

  // If we have a custom actions column, use all columns as-is
  // Otherwise, filter out actions column and let DataTable add its own
  const filteredColumns = React.useMemo(
    () =>
      hasCustomActions
        ? columns
        : columns.filter((col) => col.id !== "actions"),
    [columns, hasCustomActions],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Render toolbar if provided and table is ready */}
      {ToolbarComponent && tableInstance && (
        <div className="flex-shrink-0">
          <MobileToolbarWrapper>
            <ToolbarComponent
              table={tableInstance}
              onImportSuccess={onImportSuccess}
              onAdd={onAdd}
              filters={filters}
              isLoading={isLoading}
              dataLength={data.length}
            />
          </MobileToolbarWrapper>
        </div>
      )}

      {/* Main data display - table on desktop, grouped job cards on mobile */}
      <div className="flex-1 overflow-auto">
        <ResponsiveJobsDataDisplay
          data={data}
          columns={filteredColumns}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onMultiDelete={onMultiDelete}
          onMarkAsInvoiced={onMarkAsInvoiced}
          onBulkAttachFiles={onBulkAttachFiles}
          onAttachFiles={onAttachFiles}
          onDuplicate={onDuplicate}
          onUpdateStatus={onUpdateStatus}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={setTableInstance}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
        />
      </div>
    </div>
  );
}

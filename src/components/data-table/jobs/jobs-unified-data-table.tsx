"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import { ResponsiveJobsDataDisplay } from "./responsive-jobs-data-display";
import { MobileToolbarWrapper } from "@/components/data-table/components/mobile-toolbar-wrapper";
import type { SheetField } from "@/components/data-table/core/types";
import type { ColumnDef, Table, VisibilityState, OnChangeFn } from "@tanstack/react-table";
import type { Job } from "@/lib/types";

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

export interface JobsUnifiedDataTableProps {
  // Data and columns
  data: Job[];
  columns: ColumnDef<Job, unknown>[];
  sheetFields?: SheetField<Job, unknown>[];
  
  // Mobile view
  mobileFields?: MobileCardField[];
  expandableFields?: ExpandableDetailField[];
  getItemId?: (item: Job) => number | string;
  
  // Loading states
  isLoading?: boolean;
  loadingRowId?: number | null;
  
  // CRUD operations
  onEdit?: (data: Job) => void;
  onDelete?: (data: Job) => void;
  onMultiDelete?: (data: Job[]) => void;
  onMarkAsInvoiced?: (data: Job[]) => void;
  onAttachFiles?: (data: Job) => void;
  onAdd?: () => void;
  
  // Import/Export
  onImportSuccess?: () => void;
  
  // Toolbar component
  ToolbarComponent?: React.ComponentType<{
    table: Table<Job>;
    onImportSuccess?: () => void;
    onAdd?: () => void;
    filters?: Record<string, unknown>;
    isLoading?: boolean;
    dataLength?: number;
  }>;
  
  // Filters
  filters?: Record<string, unknown>;
  
  // Column visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
}

export function JobsUnifiedDataTable({
  data,
  columns,
  sheetFields = [],
  mobileFields,
  expandableFields = [],
  getItemId,
  isLoading = false,
  loadingRowId,
  onEdit,
  onDelete,
  onMultiDelete,
  onMarkAsInvoiced,
  onAttachFiles,
  onAdd,
  onImportSuccess,
  ToolbarComponent,
  filters,
  columnVisibility,
  onColumnVisibilityChange,
}: JobsUnifiedDataTableProps) {
  const [tableInstance, setTableInstance] = React.useState<Table<Job> | null>(null);

  // Check if columns already contain a custom actions column
  const hasCustomActions = React.useMemo(
    () => columns.some(col => col.id === 'actions'),
    [columns]
  );

  // If we have a custom actions column, use all columns as-is
  // Otherwise, filter out actions column and let DataTable add its own
  const filteredColumns = React.useMemo(
    () => hasCustomActions ? columns : columns.filter(col => col.id !== 'actions'),
    [columns, hasCustomActions]
  );

  return (
    <div className="w-full max-w-full flex flex-col h-full">
      {/* Render toolbar if provided and table is ready */}
      {ToolbarComponent && tableInstance && (
        <div className="sticky top-0 z-20">
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
      
      {/* Main data display - responsive table/cards with expandable mobile view */}
      <div className="flex-1 overflow-auto">
        {mobileFields && expandableFields ? (
        <ResponsiveJobsDataDisplay
          data={data}
          columns={filteredColumns}
          mobileFields={mobileFields}
          expandableFields={expandableFields}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onMultiDelete={onMultiDelete}
          onMarkAsInvoiced={onMarkAsInvoiced}
          onAttachFiles={onAttachFiles}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={setTableInstance}
          getItemId={getItemId}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
        />
      ) : (
        <DataTable
          data={data}
          columns={filteredColumns}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onMultiDelete={onMultiDelete}
          onMarkAsInvoiced={onMarkAsInvoiced}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={setTableInstance}
        />
      )}
      </div>
    </div>
  );
}
"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import { ResponsiveDataDisplay } from "@/components/data-table/responsive/responsive-data-display";
import { MobileToolbarWrapper } from "@/components/data-table/components/mobile-toolbar-wrapper";
import type { SheetField } from "@/components/data-table/core/types";
import type {
  ColumnDef,
  Table,
  VisibilityState,
  OnChangeFn,
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

export interface UnifiedDataTableProps<TData> {
  // Data and columns
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  sheetFields?: SheetField<TData, unknown>[];

  // Mobile view
  mobileFields?: MobileCardField[];
  onCardClick?: (data: TData) => void;
  getItemId?: (item: TData) => number | string;

  // Loading states
  isLoading?: boolean;
  loadingRowId?: number | null;

  // CRUD operations
  onEdit?: (data: TData) => void;
  onDelete?: (data: TData) => void;
  onMultiDelete?: (data: TData[]) => Promise<void>;
  onAdd?: () => void;

  // Import/Export
  onImportSuccess?: () => void;

  // Toolbar component
  ToolbarComponent?: React.ComponentType<{
    table: Table<TData>;
    onImportSuccess?: () => void;
    onAdd?: () => void;
    onMultiDelete?: (data: TData[]) => Promise<void>;
    filters?: Record<string, unknown>;
    isLoading?: boolean;
    dataLength?: number;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    activeCount?: number;
    archivedCount?: number;
  }>;

  // Extra props to pass to toolbar
  toolbarProps?: {
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    activeCount?: number;
    archivedCount?: number;
  };

  // Filters
  filters?: Record<string, unknown>;

  // Column visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;

  // Display options
  hideToolbar?: boolean;
  hidePagination?: boolean;
}

export function UnifiedDataTable<TData>({
  data,
  columns,
  sheetFields = [],
  mobileFields,
  onCardClick,
  getItemId,
  isLoading = false,
  loadingRowId,
  onEdit,
  onDelete,
  onMultiDelete,
  onAdd,
  onImportSuccess,
  ToolbarComponent,
  filters,
  columnVisibility,
  onColumnVisibilityChange,
  hideToolbar = false,
  hidePagination = false,
  toolbarProps,
}: UnifiedDataTableProps<TData>) {
  const [tableInstance, setTableInstance] = React.useState<Table<TData> | null>(
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
      {!hideToolbar && ToolbarComponent && tableInstance && (
        <div className="flex-shrink-0">
          <MobileToolbarWrapper>
            <ToolbarComponent
              table={tableInstance}
              onImportSuccess={onImportSuccess}
              onAdd={onAdd}
              onMultiDelete={onMultiDelete}
              filters={filters}
              isLoading={isLoading}
              dataLength={data.length}
              {...toolbarProps}
            />
          </MobileToolbarWrapper>
        </div>
      )}

      {/* Main data display - responsive table/cards */}
      <div className="flex-1 overflow-hidden">
        {mobileFields ? (
          <ResponsiveDataDisplay
            data={data}
            columns={filteredColumns}
            mobileFields={mobileFields}
            sheetFields={sheetFields}
            onEdit={onEdit}
            onDelete={onDelete}
            onMultiDelete={onMultiDelete}
            onCardClick={onCardClick || onEdit}
            isLoading={isLoading}
            loadingRowId={loadingRowId}
            onTableReady={setTableInstance}
            getItemId={getItemId}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={onColumnVisibilityChange}
            hidePagination={hidePagination}
          />
        ) : (
          <DataTable
            data={data}
            columns={filteredColumns}
            sheetFields={sheetFields}
            onEdit={onEdit}
            onDelete={onDelete}
            onMultiDelete={onMultiDelete}
            isLoading={isLoading}
            loadingRowId={loadingRowId}
            onTableReady={setTableInstance}
            hidePagination={hidePagination}
          />
        )}
      </div>
    </div>
  );
}

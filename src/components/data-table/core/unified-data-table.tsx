"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import { ResponsiveDataDisplay } from "@/components/data-table/responsive/responsive-data-display";
import { MobileToolbarWrapper } from "@/components/data-table/components/mobile-toolbar-wrapper";
import type { SheetField } from "@/components/data-table/core/types";
import type { ColumnDef, Table, VisibilityState, OnChangeFn } from "@tanstack/react-table";

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
  onAdd?: () => void;
  
  // Import/Export
  onImportSuccess?: () => void;
  
  // Toolbar component
  ToolbarComponent?: React.ComponentType<{
    table: Table<TData>;
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
  onAdd,
  onImportSuccess,
  ToolbarComponent,
  filters,
  columnVisibility,
  onColumnVisibilityChange,
}: UnifiedDataTableProps<TData>) {
  const [tableInstance, setTableInstance] = React.useState<Table<TData> | null>(null);

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
    <div className="space-y-4 w-full max-w-full">
      {/* Render toolbar if provided and table is ready */}
      {ToolbarComponent && tableInstance && (
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
      )}
      
      {/* Main data display - responsive table/cards */}
      {mobileFields ? (
        <ResponsiveDataDisplay
          data={data}
          columns={filteredColumns}
          mobileFields={mobileFields}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onCardClick={onCardClick || onEdit}
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
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={setTableInstance}
        />
      )}
    </div>
  );
}
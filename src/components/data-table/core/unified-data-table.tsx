"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import type { SheetField } from "@/components/data-table/core/types";
import type { ColumnDef, Table } from "@tanstack/react-table";

export interface UnifiedDataTableProps<TData> {
  // Data and columns
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  sheetFields?: SheetField<TData, unknown>[];
  
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
  }>;
  
  // Filters
  filters?: Record<string, unknown>;
}

export function UnifiedDataTable<TData>({
  data,
  columns,
  sheetFields = [],
  isLoading = false,
  loadingRowId,
  onEdit,
  onDelete,
  onAdd,
  onImportSuccess,
  ToolbarComponent,
  filters,
}: UnifiedDataTableProps<TData>) {
  const [tableInstance, setTableInstance] = React.useState<Table<TData> | null>(null);

  // Filter columns to remove actions column since DataTable will add it
  const filteredColumns = React.useMemo(
    () => columns.filter(col => col.id !== 'actions'),
    [columns]
  );

  return (
    <div className="space-y-4">
      {/* Render toolbar if provided and table is ready */}
      {ToolbarComponent && tableInstance && (
        <ToolbarComponent
          table={tableInstance}
          onImportSuccess={onImportSuccess}
          onAdd={onAdd}
          filters={filters}
          isLoading={isLoading}
        />
      )}
      
      {/* Main data table */}
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
    </div>
  );
}
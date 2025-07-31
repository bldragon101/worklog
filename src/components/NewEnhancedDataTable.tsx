"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/data-table";
import { columns } from "@/components/columns";
import { worklogSheetFields } from "@/components/worklog-sheet-fields";
import { DataTableToolbar } from "./data-table-toolbar";

export type WorkLog = {
  id: number;
  date: string;
  driver: string;
  customer: string;
  billTo: string;
  registration: string;
  truckType: string;
  pickup: string;
  dropoff: string;
  runsheet: boolean | null;
  invoiced: boolean | null;
  chargedHours: number | null;
  driverCharge: number | null;
  comments: string | null;
};

interface NewEnhancedDataTableProps {
  data: WorkLog[];
  isLoading: boolean;
  onEdit: (log: WorkLog) => void;
  onDelete: (log: WorkLog) => void;
  loadingRowId?: number | null;
  onImportSuccess?: () => void;
  onAddEntry?: () => void;
  onUpdateStatus?: (id: number, field: 'runsheet' | 'invoiced', value: boolean) => Promise<void>;
  filters?: {
    startDate?: string;
    endDate?: string;
    customer?: string;
    driver?: string;
  };
}

export function NewEnhancedDataTable({
  data,
  isLoading,
  onEdit,
  onDelete,
  loadingRowId,
  onImportSuccess,
  onAddEntry,
  onUpdateStatus,
  filters,
}: NewEnhancedDataTableProps) {
  // Create columns without actions since DataTable will add the sheet details
  const tableColumns = React.useMemo(
    () => columns(onEdit, onDelete, isLoading, loadingRowId, onUpdateStatus).filter(col => col.id !== 'actions'),
    [onEdit, onDelete, isLoading, loadingRowId, onUpdateStatus]
  );

  // We need to get the table instance from DataTable component
  // Let's create a modified version that exposes the table
  const [tableInstance, setTableInstance] = React.useState<unknown>(null);

  return (
    <div className="space-y-4">
      {tableInstance && (
        <DataTableToolbar 
          table={tableInstance}
          type="worklog"
          onImportSuccess={onImportSuccess}
          onAddEntry={onAddEntry}
        />
      )}
      <DataTable
        columns={tableColumns}
        data={data}
        sheetFields={worklogSheetFields}
        onEdit={onEdit}
        onDelete={onDelete}
        isLoading={isLoading}
        loadingRowId={loadingRowId}
        onTableReady={setTableInstance}
      />
    </div>
  );
}
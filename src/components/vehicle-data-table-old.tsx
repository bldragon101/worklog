"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/data-table";
import { vehicleColumns, Vehicle } from "@/components/vehicle-columns";
import { vehicleSheetFields } from "@/components/vehicle-sheet-fields";
import { VehicleDataTableToolbar } from "./vehicle-data-table-toolbar";
import { Table } from "@tanstack/react-table";

interface VehicleDataTableProps {
  data: Vehicle[];
  isLoading: boolean;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
  loadingRowId?: number | null;
  onImportSuccess?: () => void;
  onAddVehicle?: () => void;
  filters?: {
    registration?: string;
    type?: string;
  };
}

export function VehicleDataTable({
  data,
  isLoading,
  onEdit,
  onDelete,
  loadingRowId,
  onImportSuccess,
  onAddVehicle,
  filters,
}: VehicleDataTableProps) {
  // Create columns without actions since DataTable will add the sheet details
  const tableColumns = React.useMemo(
    () => vehicleColumns(onEdit, onDelete, isLoading, loadingRowId).filter(col => col.id !== 'actions'),
    [onEdit, onDelete, isLoading, loadingRowId]
  );

  // We need to get the table instance from DataTable component
  const [tableInstance, setTableInstance] = React.useState<Table<Vehicle> | null>(null);

  return (
    <div className="space-y-4">
      {tableInstance && (
        <VehicleDataTableToolbar 
          table={tableInstance}
          onImportSuccess={onImportSuccess}
          onAddVehicle={onAddVehicle}
          filters={filters}
        />
      )}
      <DataTable
        columns={tableColumns}
        data={data}
        sheetFields={vehicleSheetFields}
        onEdit={onEdit}
        onDelete={onDelete}
        isLoading={isLoading}
        loadingRowId={loadingRowId}
        onTableReady={setTableInstance}
      />
    </div>
  );
}
"use client"

import type { DataTableInstance } from "@/components/data-table/core/table-features"
import { VehicleDataTableToolbar } from "./vehicle-data-table-toolbar"
import { Vehicle } from "@/lib/types"

interface VehicleDataTableToolbarWrapperProps {
  table: DataTableInstance<Vehicle>
  onImportSuccess?: () => void
  onAdd?: () => void
  onMultiDelete?: (data: Vehicle[]) => Promise<void>
}

export function VehicleDataTableToolbarWrapper({
  table,
  onImportSuccess,
  onAdd,
  onMultiDelete,
}: VehicleDataTableToolbarWrapperProps) {
  return (
    <VehicleDataTableToolbar
      table={table}
      onImportSuccess={onImportSuccess}
      onAddVehicle={onAdd}
      onMultiDelete={onMultiDelete}
    />
  )
}
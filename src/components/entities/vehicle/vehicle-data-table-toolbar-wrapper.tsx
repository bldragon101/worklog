"use client"

import { Table } from "@tanstack/react-table"
import { VehicleDataTableToolbar } from "./vehicle-data-table-toolbar"
import { Vehicle } from "@/lib/types"

interface VehicleDataTableToolbarWrapperProps {
  table: Table<Vehicle>
  onImportSuccess?: () => void
  onAdd?: () => void
}

export function VehicleDataTableToolbarWrapper({
  table,
  onImportSuccess,
  onAdd,
}: VehicleDataTableToolbarWrapperProps) {
  return (
    <VehicleDataTableToolbar
      table={table}
      onImportSuccess={onImportSuccess}
      onAddVehicle={onAdd}
    />
  )
}
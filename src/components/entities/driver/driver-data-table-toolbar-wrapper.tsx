"use client"

import { Table } from "@tanstack/react-table"
import { DriverDataTableToolbar } from "./driver-data-table-toolbar"
import type { Driver } from "@/lib/types"

interface DriverDataTableToolbarWrapperProps {
  table: Table<Driver>
  onImportSuccess?: () => void
  onAdd?: () => void
}

export function DriverDataTableToolbarWrapper({
  table,
  onAdd,
  onImportSuccess,
}: DriverDataTableToolbarWrapperProps) {
  // Extract current filter values from table state
  const globalFilter = table.getState().globalFilter || ""
  const typeFilter = table.getColumn("type")?.getFilterValue() as string | undefined
  
  const filters = {
    driver: globalFilter,
    type: typeFilter
  }

  return (
    <DriverDataTableToolbar
      table={table}
      onAddDriver={onAdd}
      onImportSuccess={onImportSuccess}
      filters={filters}
    />
  )
}
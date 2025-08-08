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
}: DriverDataTableToolbarWrapperProps) {
  return (
    <DriverDataTableToolbar
      table={table}
      onAddDriver={onAdd}
    />
  )
}
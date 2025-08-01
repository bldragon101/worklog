"use client"

import { Table } from "@tanstack/react-table"
import { DataTableToolbar } from "./data-table-toolbar"
import { WorkLog } from "@/lib/types"

interface WorklogDataTableToolbarProps {
  table: Table<WorkLog>
  onImportSuccess?: () => void
  onAdd?: () => void
}

export function WorklogDataTableToolbar({
  table,
  onImportSuccess,
  onAdd,
}: WorklogDataTableToolbarProps) {
  return (
    <DataTableToolbar
      table={table}
      type="worklog"
      onImportSuccess={onImportSuccess}
      onAddEntry={onAdd}
    />
  )
}
"use client"

import { Table } from "@tanstack/react-table"
import { DataTableToolbar } from "../../data-table/components/data-table-toolbar"
import { Job } from "@/lib/types"

interface JobDataTableToolbarProps {
  table: Table<Job>
  onImportSuccess?: () => void
  onAdd?: () => void
}

export function JobDataTableToolbar({
  table,
  onImportSuccess,
  onAdd,
}: JobDataTableToolbarProps) {
  return (
    <DataTableToolbar
      table={table}
      type="jobs"
      onImportSuccess={onImportSuccess}
      onAddEntry={onAdd}
    />
  )
}
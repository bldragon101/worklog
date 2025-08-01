"use client"

import { Table } from "@tanstack/react-table"
import { CustomerDataTableToolbar } from "./customer-data-table-toolbar"
import { Customer } from "@/lib/types"

interface CustomerDataTableToolbarWrapperProps {
  table: Table<Customer>
  onImportSuccess?: () => void
  onAdd?: () => void
}

export function CustomerDataTableToolbarWrapper({
  table,
  onImportSuccess,
  onAdd,
}: CustomerDataTableToolbarWrapperProps) {
  return (
    <CustomerDataTableToolbar
      table={table}
      onImportSuccess={onImportSuccess}
      onAddCustomer={onAdd}
    />
  )
}
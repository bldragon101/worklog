"use client"

import { Table } from "@tanstack/react-table"
import { CustomerDataTableToolbar } from "./customer-data-table-toolbar"
import { Customer } from "@/lib/types"

interface CustomerDataTableToolbarWrapperProps {
  table: Table<Customer>
  onImportSuccess?: () => void
  onAdd?: () => void
  onMultiDelete?: (data: Customer[]) => Promise<void>
}

export function CustomerDataTableToolbarWrapper({
  table,
  onImportSuccess,
  onAdd,
  onMultiDelete,
}: CustomerDataTableToolbarWrapperProps) {
  return (
    <CustomerDataTableToolbar
      table={table}
      onImportSuccess={onImportSuccess}
      onAddCustomer={onAdd}
      onMultiDelete={onMultiDelete}
    />
  )
}
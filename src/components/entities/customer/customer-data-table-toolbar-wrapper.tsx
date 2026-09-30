"use client"

import type { DataTableInstance } from "@/components/data-table/core/table-features"
import { useState } from "react"

import { CustomerDataTableToolbar } from "./customer-data-table-toolbar"
import { CustomerBulkUpdateDialog } from "./customer-bulk-update-dialog"
import { usePermissions } from "@/hooks/use-permissions"
import { Customer } from "@/lib/types"

interface CustomerDataTableToolbarWrapperProps {
  table: DataTableInstance<Customer>
  onImportSuccess?: () => void
  onAdd?: () => void
  onMultiDelete?: (data: Customer[]) => Promise<void>
  onRefresh?: () => void
}

export function CustomerDataTableToolbarWrapper({
  table,
  onImportSuccess,
  onAdd,
  onMultiDelete,
  onRefresh,
}: CustomerDataTableToolbarWrapperProps) {
  const { isAdmin } = usePermissions()
  const [bulkUpdateCustomers, setBulkUpdateCustomers] = useState<Customer[]>([])
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false)

  const handleBulkUpdate = (customers: Customer[]) => {
    setBulkUpdateCustomers(customers)
    setIsBulkUpdateOpen(true)
  }

  const handleBulkUpdateSuccess = () => {
    table.toggleAllRowsSelected(false)
    onRefresh?.()
  }

  return (
    <>
      <CustomerDataTableToolbar
        table={table}
        onImportSuccess={onImportSuccess}
        onAddCustomer={onAdd}
        onMultiDelete={onMultiDelete}
        onBulkUpdate={isAdmin ? handleBulkUpdate : undefined}
      />
      {isAdmin && (
        <CustomerBulkUpdateDialog
          open={isBulkUpdateOpen}
          onOpenChange={setIsBulkUpdateOpen}
          customers={bulkUpdateCustomers}
          onSuccess={handleBulkUpdateSuccess}
        />
      )}
    </>
  )
}

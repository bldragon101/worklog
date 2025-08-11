"use client"

import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"
import { useState } from "react"
import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CsvImportExport } from "@/components/shared/csv-import-export"

interface CustomerDataTableToolbarProps<TData> {
  table: Table<TData>
  onImportSuccess?: () => void
  onAddCustomer?: () => void
  filters?: {
    customer?: string
    billTo?: string
  }
}

export function CustomerDataTableToolbar<TData>({
  table,
  onImportSuccess,
  onAddCustomer,
  filters,
}: CustomerDataTableToolbarProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState<string>("")
  const [localColumnVisibility, setLocalColumnVisibility] = useState<Record<string, boolean>>({})
  
  const isFiltered = globalFilter

  const handleGlobalFilter = (value: string) => {
    setGlobalFilter(value)
    table.setGlobalFilter(value)
  }

  const handleReset = () => {
    setGlobalFilter("")
    table.setGlobalFilter("")
  }

  // Initialize local column visibility state
  React.useEffect(() => {
    const initialVisibility: Record<string, boolean> = {}
    table.getAllColumns().forEach(column => {
      if (column.getCanHide()) {
        initialVisibility[column.id] = column.getIsVisible()
      }
    })
    setLocalColumnVisibility(initialVisibility)
  }, [table])

  const handleColumnToggle = (columnId: string, value: boolean) => {
    const column = table.getColumn(columnId)
    if (column) {
      column.toggleVisibility(value)
      setLocalColumnVisibility(prev => ({
        ...prev,
        [columnId]: value
      }))
    }
  }

  return (
    <div className="space-y-2 px-4">
      {/* First row: Search and primary action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <Input
            id="customer-search-input"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(event) => handleGlobalFilter(event.target.value)}
            className="h-8 w-full min-w-0 sm:max-w-[300px] bg-white dark:bg-gray-950"
          />
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={handleReset}
              className="h-8 px-2 lg:px-3 flex-shrink-0"
            >
              <span className="hidden sm:inline">Reset</span>
              <span className="sm:hidden">×</span>
              <Cross2Icon className="ml-2 h-4 w-4 hidden sm:inline" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
            <CsvImportExport 
              type="customers" 
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" && column.getCanHide()
                  )
                  .map((column) => {
                    const isVisible = localColumnVisibility[column.id] ?? column.getIsVisible()
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={isVisible}
                        onCheckedChange={(value) => handleColumnToggle(column.id, !!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {onAddCustomer && (
            <Button 
              id="add-customer-btn"
              onClick={onAddCustomer} 
              className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 h-8 min-w-0 sm:w-auto"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Add Customer</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile only: Second row for secondary actions */}
      <div className="sm:hidden flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" && column.getCanHide()
              )
              .map((column) => {
                const isVisible = localColumnVisibility[column.id] ?? column.getIsVisible()
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={isVisible}
                    onCheckedChange={(value) => handleColumnToggle(column.id, !!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        <CsvImportExport 
          type="customers" 
          onImportSuccess={onImportSuccess}
          filters={filters}
        />
      </div>
    </div>
  )
}

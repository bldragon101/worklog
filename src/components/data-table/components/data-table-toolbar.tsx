"use client"

import { Table } from "@tanstack/react-table"
import { useState } from "react"
import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CsvImportExportDropdown } from "@/components/shared/csv-import-export-dropdown"
import { useSearch } from "@/contexts/search-context"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  type: 'jobs' | 'customers'
  onImportSuccess?: () => void
  onAddEntry?: () => void
  onAddCustomer?: () => void
  filters?: {
    startDate?: string
    endDate?: string
    customer?: string
    driver?: string
    billTo?: string
  }
}

export function DataTableToolbar<TData>({
  table,
  type,
  onImportSuccess,
  onAddEntry,
  onAddCustomer,
  filters,
}: DataTableToolbarProps<TData>) {
  const { globalSearchValue } = useSearch();
  const [localColumnVisibility, setLocalColumnVisibility] = useState<Record<string, boolean>>({})

  // Apply global search to table when globalSearchValue changes
  React.useEffect(() => {
    table.setGlobalFilter(globalSearchValue)
  }, [globalSearchValue, table])

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
    <div className="space-y-2">
      {/* Toolbar actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        <div className="flex items-center justify-end gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
            <CsvImportExportDropdown 
              type={type} 
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded">
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
          <div className="sm:hidden flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded">
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
            <CsvImportExportDropdown 
              type={type} 
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
          </div>
          {type === 'jobs' && onAddEntry && (
            <Button 
              id="add-entry-btn"
              onClick={onAddEntry} 
              className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 h-8 min-w-0 sm:w-auto rounded"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Add Entry</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
          {type === 'customers' && onAddCustomer && (
            <Button 
              id="add-customer-general-btn"
              onClick={onAddCustomer} 
              className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 h-8 min-w-0 sm:w-auto rounded"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Add Customer</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

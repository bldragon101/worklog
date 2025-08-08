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
    <div className="flex items-center justify-between px-4">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          id="search-input"
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(event) => handleGlobalFilter(event.target.value)}
          className="h-8 w-[200px] lg:w-[300px] bg-white dark:bg-input/30"
        />
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <CsvImportExport 
          type={type} 
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
        {type === 'jobs' && onAddEntry && (
          <Button onClick={onAddEntry} className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        )}
        {type === 'customers' && onAddCustomer && (
          <Button onClick={onAddCustomer} className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        )}
      </div>
    </div>
  )
}

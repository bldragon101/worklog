"use client"

import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"
import { useState } from "react"

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
import { CsvImportExport } from "@/components/CsvImportExport"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  type: 'worklog' | 'customers'
  onImportSuccess?: () => void
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
  filters,
}: DataTableToolbarProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState<string>("")
  
  const isFiltered = globalFilter

  const handleGlobalFilter = (value: string) => {
    setGlobalFilter(value)
    table.setGlobalFilter(value)
  }

  const handleReset = () => {
    setGlobalFilter("")
    table.setGlobalFilter("")
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(event) => handleGlobalFilter(event.target.value)}
          className="h-8 w-[200px] lg:w-[300px]"
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
            <Button variant="outline" className="ml-auto">
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
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

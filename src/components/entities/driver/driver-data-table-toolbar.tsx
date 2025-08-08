"use client"

import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/components/data-table/components/data-table-faceted-filter"
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options"
import { Plus } from "lucide-react"
import { useState } from "react"
import type { Driver } from "@/lib/types"

interface DriverDataTableToolbarProps {
  table: Table<Driver>
  onAddDriver?: () => void
}

export function DriverDataTableToolbar({
  table,
  onAddDriver,
}: DriverDataTableToolbarProps) {
  const [globalFilter, setGlobalFilter] = useState<string>("")
  const isFiltered = globalFilter || table.getState().columnFilters.length > 0

  const handleGlobalFilter = (value: string) => {
    setGlobalFilter(value)
    table.setGlobalFilter(value)
  }

  const handleReset = () => {
    setGlobalFilter("")
    table.setGlobalFilter("")
    table.resetColumnFilters()
  }

  const driverTypeOptions = [
    {
      label: "Employee",
      value: "Employee",
    },
    {
      label: "Contractor", 
      value: "Contractor",
    },
    {
      label: "Subcontractor", 
      value: "Subcontractor",
    },
  ]

  return (
    <div className="flex items-center justify-between px-4">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          id="driver-search-input"
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(event) => handleGlobalFilter(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px] bg-white dark:bg-gray-950"
        />
        {table.getColumn("type") && (
          <DataTableFacetedFilter
            column={table.getColumn("type")}
            title="Type"
            options={driverTypeOptions}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="h-8 px-2 lg:px-3"
          >
            Reset
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <DataTableViewOptions table={table} />
        {onAddDriver && (
          <Button
            id="add-driver-btn"
            onClick={onAddDriver}
            size="sm"
            className="ml-auto h-8"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        )}
      </div>
    </div>
  )
}
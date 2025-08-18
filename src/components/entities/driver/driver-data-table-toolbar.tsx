"use client"

import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilterSimple } from "@/components/data-table/components/data-table-faceted-filter-simple"
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options"
import { Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import type { Driver } from "@/lib/types"
import { CsvImportExport } from "@/components/shared/csv-import-export"

interface DriverDataTableToolbarProps {
  table: Table<Driver>
  onAddDriver?: () => void
  onImportSuccess?: () => void
  filters?: {
    driver?: string
    type?: string
  }
  isLoading?: boolean
}

export function DriverDataTableToolbar({
  table,
  onAddDriver,
  onImportSuccess,
  filters,
  isLoading = false,
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
    <div className="space-y-2">
      {/* First row: Search and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <Input
            id="driver-search-input"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(event) => handleGlobalFilter(event.target.value)}
            className="h-8 w-full min-w-0 sm:max-w-[250px] bg-white dark:bg-gray-950"
          />
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={handleReset}
              className="h-8 px-2 lg:px-3 flex-shrink-0"
            >
              <span className="hidden sm:inline">Reset</span>
              <span className="sm:hidden">×</span>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
            <CsvImportExport 
              type="drivers" 
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
            <DataTableViewOptions table={table} />
          </div>
          <div className="sm:hidden flex items-center gap-2">
            <DataTableViewOptions table={table} />
            <CsvImportExport 
              type="drivers" 
              onImportSuccess={onImportSuccess}
              filters={filters}
            />
          </div>
          {onAddDriver && (
            <Button
              id="add-driver-btn"
              onClick={onAddDriver}
              size="sm"
              className="h-8 min-w-0 sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden xs:inline">Add Driver</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Second row: Filters */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          table.getColumn("type") && (
            <DataTableFacetedFilterSimple
              column={table.getColumn("type")}
              title="Type"
              options={driverTypeOptions}
            />
          )
        )}
      </div>
    </div>
  )
}
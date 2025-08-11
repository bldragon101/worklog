"use client"

import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilterSimple } from "@/components/data-table/components/data-table-faceted-filter-simple"
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options"
import { Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import type { Job } from "@/lib/types"
import { CsvImportExport } from "@/components/shared/csv-import-export"

interface JobDataTableToolbarProps {
  table: Table<Job>
  onAdd?: () => void
  onImportSuccess?: () => void
  filters?: {
    startDate?: string
    endDate?: string
    driver?: string
    customer?: string
    billTo?: string
    registration?: string
    truckType?: string
  }
  isLoading?: boolean
  dataLength?: number
}

export function JobDataTableToolbar({
  table,
  onAdd,
  onImportSuccess,
  filters,
  isLoading = false,
  dataLength = 0,
}: JobDataTableToolbarProps) {
  const [globalFilter, setGlobalFilter] = useState<string>("")
  const [dateOptions, setDateOptions] = useState<{ label: string; value: string }[]>([])
  const [driverOptions, setDriverOptions] = useState<{ label: string; value: string }[]>([])
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: string }[]>([])
  const [billToOptions, setBillToOptions] = useState<{ label: string; value: string }[]>([])
  const [registrationOptions, setRegistrationOptions] = useState<{ label: string; value: string }[]>([])
  const [truckTypeOptions, setTruckTypeOptions] = useState<{ label: string; value: string }[]>([])

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

  // Update filter options based on current table data
  useEffect(() => {
    const tableData = table.getCoreRowModel().rows.map(row => row.original)
    updateFilterOptions(tableData)
  }, [dataLength, table])

  const updateFilterOptions = (data: Job[]) => {
    if (data.length === 0) {
      // Clear all filter options when no data
      setDateOptions([])
      setDriverOptions([])
      setCustomerOptions([])
      setBillToOptions([])
      setRegistrationOptions([])
      setTruckTypeOptions([])
      return
    }

    // Get unique values for each column, filtering out null/undefined/empty values
    const dates = [...new Set(data.map(job => job.date).filter(value => value && value.trim()))].sort()
    const drivers = [...new Set(data.map(job => job.driver).filter(value => value && value.trim()))].sort()
    const customers = [...new Set(data.map(job => job.customer).filter(value => value && value.trim()))].sort()
    const billTos = [...new Set(data.map(job => job.billTo).filter(value => value && value.trim()))].sort()
    const registrations = [...new Set(data.map(job => job.registration).filter(value => value && value.trim()))].sort()
    const truckTypes = [...new Set(data.map(job => job.truckType).filter(value => value && value.trim()))].sort()

    // Format dates with day names for display
    const dateOptionsFormatted = dates.map(dateStr => {
      const date = new Date(dateStr)
      return {
        label: `${format(date, "dd/MM/yyyy")} (${format(date, "EEE")})`,
        value: dateStr
      }
    })

    setDateOptions(dateOptionsFormatted)
    setDriverOptions(drivers.map(value => ({ label: value, value })))
    setCustomerOptions(customers.map(value => ({ label: value, value })))
    setBillToOptions(billTos.map(value => ({ label: value, value })))
    setRegistrationOptions(registrations.map(value => ({ label: value, value })))
    setTruckTypeOptions(truckTypes.map(value => ({ label: value, value })))
  }


  const runsheetOptions = [
    { label: "Yes", value: "true" },
    { label: "No", value: "false" },
  ]

  const invoicedOptions = [
    { label: "Yes", value: "true" },
    { label: "No", value: "false" },
  ]

  return (
    <div className="space-y-4 px-4">
      {/* First row: Search and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Input
            id="job-search-input"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(event) => handleGlobalFilter(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px] bg-white dark:bg-gray-950"
          />
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
          <CsvImportExport 
            type="jobs" 
            onImportSuccess={onImportSuccess}
            filters={filters}
          />
          <DataTableViewOptions table={table} />
          {onAdd && (
            <Button
              id="add-job-btn"
              onClick={onAdd}
              size="sm"
              className="ml-auto h-8"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Second row: Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {isLoading ? (
          // Show skeleton filters while loading
          <>
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-20" />
            ))}
          </>
        ) : (
          <>
            {table.getColumn("date") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("date")}
                title="Date"
                options={dateOptions}
              />
            )}
            {table.getColumn("driver") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("driver")}
                title="Driver"
                options={driverOptions}
              />
            )}
            {table.getColumn("customer") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("customer")}
                title="Customer"
                options={customerOptions}
              />
            )}
            {table.getColumn("billTo") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("billTo")}
                title="Bill To"
                options={billToOptions}
              />
            )}
            {table.getColumn("registration") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("registration")}
                title="Registration"
                options={registrationOptions}
              />
            )}
            {table.getColumn("truckType") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("truckType")}
                title="Truck Type"
                options={truckTypeOptions}
              />
            )}
            {table.getColumn("runsheet") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("runsheet")}
                title="Runsheet"
                options={runsheetOptions}
              />
            )}
            {table.getColumn("invoiced") && (
              <DataTableFacetedFilterSimple
                column={table.getColumn("invoiced")}
                title="Invoiced"
                options={invoicedOptions}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
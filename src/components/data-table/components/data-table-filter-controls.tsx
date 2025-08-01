"use client"

import * as React from "react"
import { Table } from "@tanstack/react-table"

import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { DataTableViewOptions } from "./data-table-view-options"

interface DataTableFilterControlsProps<TData> {
  table: Table<TData>
}

export function DataTableFilterControls<TData>({
  table,
}: DataTableFilterControlsProps<TData>) {

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter logs..."
          value={(table.getColumn("customer")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("customer")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {table.getColumn("driver") && (
            <DataTableFacetedFilter
              column={table.getColumn("driver")}
              title="Driver"
              options={[
                {
                  label: "All",
                  value: "all",
                },
                ...Array.from(
                  new Set(
                    table
                      .getFilteredRowModel()
                      .rows.map((row) => row.getValue("driver"))
                  )
                ).map((driver) => ({
                  label: driver as string,
                  value: driver as string,
                })),
              ]}
            />
          )}
          {table.getColumn("customer") && (
            <DataTableFacetedFilter
              column={table.getColumn("customer")}
              title="Customer"
              options={[
                {
                  label: "All",
                  value: "all",
                },
                ...Array.from(
                  new Set(
                    table
                      .getFilteredRowModel()
                      .rows.map((row) => row.getValue("customer"))
                  )
                ).map((customer) => ({
                  label: customer as string,
                  value: customer as string,
                })),
              ]}
            />
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
} 
"use client"

import * as React from "react"
import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"



interface DataTableToolbarProps<TData> {
  table: Table<TData>
}

export function DataTableResetButton<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <Button
      variant="ghost"
      onClick={() => table.resetColumnFilters()}
      className="h-8 px-2 lg:px-3"
    >
      Reset
      <Cross2Icon className="ml-2 h-4 w-4" />
    </Button>
  )
} 
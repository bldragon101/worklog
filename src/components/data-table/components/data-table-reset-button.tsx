"use client"

import * as React from "react"
import { Cross2Icon } from "@radix-ui/react-icons"
import { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"



interface DataTableToolbarProps<TData> {
  table: Table<TData>
}

export function DataTableResetButton<TData>({
  table,
}: DataTableToolbarProps<TData>) {
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
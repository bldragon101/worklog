"use client"

import * as React from "react"
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useMediaQuery } from "@/hooks/use-media-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { columns } from "./columns"

export type WorkLog = {
  id: number;
  date: string;
  driver: string;
  customer: string;
  billTo: string;
  registration: string;
  truckType: string;
  pickup: string;
  dropoff: string;
  runsheet: boolean | null;
  invoiced: boolean | null;
  chargedHours: number | null;
  driverCharge: number | null;
  comments: string | null;
};

interface DataTableProps {
  data: WorkLog[]
  isLoading: boolean
  onEdit: (log: WorkLog) => void
  onDelete: (log: WorkLog) => void
}

export function DataTable({ data, isLoading, onEdit, onDelete }: DataTableProps) {
  // More granular breakpoints for better responsive behavior
  const isXLarge = useMediaQuery("(min-width: 1400px)")
  const isLarge = useMediaQuery("(min-width: 1200px) and (max-width: 1399px)")
  const isMedium = useMediaQuery("(min-width: 1024px) and (max-width: 1199px)")
  const isSmall = useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
  const isXSmall = useMediaQuery("(max-width: 767px)")

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  React.useEffect(() => {
    if (isXSmall) {
      // Mobile: Show only essential columns
      setColumnVisibility({
        billTo: false,
        registration: false,
        truckType: false,
        pickup: false,
        dropoff: false,
        runsheet: false,
        invoiced: false,
        comments: false,
      })
    } else if (isSmall) {
      // Small tablet: Hide most columns
      setColumnVisibility({
        billTo: false,
        registration: false,
        truckType: false,
        pickup: false,
        dropoff: false,
        runsheet: false,
        invoiced: false,
        comments: false,
      })
    } else if (isMedium) {
      // Medium screens: Hide many columns to fit in sidebar layout
      setColumnVisibility({
        billTo: false,
        truckType: false,
        pickup: false,
        dropoff: false,
        runsheet: false,
        invoiced: false,
        comments: false,
      })
    } else if (isLarge) {
      // Large screens: Hide some columns
      setColumnVisibility({
        pickup: false,
        dropoff: false,
        runsheet: false,
        invoiced: false,
        comments: false,
      })
    } else {
      // Extra large screens: Hide only comments and less important columns
      setColumnVisibility({
        pickup: false,
        dropoff: false,
        comments: false,
      })
    }
  }, [isXSmall, isSmall, isMedium, isLarge, isXLarge])

  const tableColumns = React.useMemo(() => columns(onEdit, onDelete), [onEdit, onDelete])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className="flex flex-col h-full space-y-4">
      <DataTableToolbar table={table} />
      <div className="flex-1 rounded-md border overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <Table className="border-collapse">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-24 text-center"
                >
                  Fetching logs...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}

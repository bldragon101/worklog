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
import { CustomerDataTableToolbar } from "./customer-data-table-toolbar"
import { customerColumns, Customer } from "./customer-columns"

interface CustomerDataTableProps {
  data: Customer[]
  isLoading: boolean
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}

export function CustomerDataTable({ data, isLoading, onEdit, onDelete }: CustomerDataTableProps) {
  // Only hide columns on very small screens (mobile)
  const isMobile = useMediaQuery("(max-width: 767px)")

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  React.useEffect(() => {
    if (isMobile) {
      // Mobile: Show only essential columns
      setColumnVisibility({
        billTo: false,
        contact: false,
        email: false,
        phoneNumber: false,
        services: false,
        semiServices: false,
        fuelLevy: false,
        tolls: false,
        comments: false,
      })
    } else {
      // Desktop and tablet: Show all columns with text wrapping
      setColumnVisibility({})
    }
  }, [isMobile])

  const tableColumns = React.useMemo(() => customerColumns(onEdit, onDelete), [onEdit, onDelete])

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

  // Track expanded row by id
  const [expandedRowId, setExpandedRowId] = React.useState<number | null>(null);

  const handleRowClick = (rowId: number) => {
    setExpandedRowId(prev => (prev === rowId ? null : rowId));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <CustomerDataTableToolbar table={table} />
      <div className="flex-1 rounded-md border overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <Table className="border-collapse w-full table-fixed" style={{ minWidth: '1000px' }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const width = header.column.columnDef.size ? `${header.column.columnDef.size}px` : 'auto'
                    return (
                      <TableHead 
                        key={header.id} 
                        colSpan={header.colSpan}
                        style={{ width }}
                      >
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
                    Fetching customers...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => handleRowClick(row.original.id)}
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
                    {expandedRowId === row.original.id && (
                      <TableRow>
                        <TableCell colSpan={tableColumns.length} className="bg-gray-100 dark:bg-gray-800 p-4 text-xs">
                          <div className="flex flex-col gap-2">
                            <div><span className="font-semibold">Fuel Levy:</span> {row.original.fuelLevy ?? "N/A"}</div>
                            <div><span className="font-semibold">Tolls:</span> {row.original.tolls ? `${row.original.tolls}%` : "N/A"}</div>
                            <div><span className="font-semibold">Comments:</span> {row.original.comments ?? "N/A"}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center"
                  >
                    No customers found.
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

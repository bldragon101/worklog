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
  loadingRowId?: number | null
  onImportSuccess?: () => void
  filters?: {
    startDate?: string
    endDate?: string
    customer?: string
    driver?: string
  }
}

export function DataTable({ data, isLoading, onEdit, onDelete, loadingRowId, onImportSuccess, filters }: DataTableProps) {
  // Only hide columns on very small screens (mobile)
  const isMobile = useMediaQuery("(max-width: 767px)")

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState({})

  React.useEffect(() => {
    if (isMobile) {
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
    } else {
      // Desktop and tablet: Show all columns with text wrapping
      setColumnVisibility({})
    }
  }, [isMobile])

  const tableColumns = React.useMemo(() => columns(onEdit, onDelete, isLoading, loadingRowId), [onEdit, onDelete, isLoading, loadingRowId])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  })

  // Track expanded row by id
  const [expandedRowId, setExpandedRowId] = React.useState<number | null>(null);

  const handleRowClick = (rowId: number) => {
    setExpandedRowId(prev => (prev === rowId ? null : rowId));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <DataTableToolbar 
        table={table} 
        type="worklog"
        onImportSuccess={onImportSuccess}
        filters={filters}
      />
      <div className="flex-1 rounded-md border overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <Table className="w-full border-collapse">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id} 
                      colSpan={header.colSpan}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
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
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => handleRowClick(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                          }}
                        >
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
                            <div><span className="font-semibold">Charged Hours:</span> {row.original.chargedHours ?? "N/A"}</div>
                            <div><span className="font-semibold">Driver Charge:</span> {row.original.driverCharge ?? "N/A"}</div>
                            {/* Add more details here if needed */}
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

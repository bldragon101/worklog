"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkLog } from "@/components/DataTable"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { DataTableRowActions } from "@/components/data-table-row-actions"
import { format } from "date-fns"

export const columns = (
  onEdit: (log: WorkLog) => void,
  onDelete: (log: WorkLog) => void,
  isLoading?: boolean,
  loadingRowId?: number | null
): ColumnDef<WorkLog, any>[] => [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("date"))
      return <div className="whitespace-nowrap text-xs">{format(date, "dd/MM")}</div>
    },
    enableColumnFilter: true,
    size: 70,
    minSize: 60,
    maxSize: 80,
  },
  {
    accessorKey: "driver",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Driver" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("driver")}</div>
    ),
    enableColumnFilter: true,
    size: 90,
    minSize: 75,
    maxSize: 120,
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("customer")}</div>
    ),
    enableColumnFilter: true,
    size: 100,
    minSize: 85,
    maxSize: 150,
  },
  {
    accessorKey: "billTo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bill To" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("billTo")}</div>
    ),
    enableColumnFilter: true,
    size: 90,
    minSize: 75,
    maxSize: 120,
  },
  {
    accessorKey: "registration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reg" />
    ),
    cell: ({ row }) => (
      <div className="font-mono whitespace-nowrap text-xs">{row.getValue("registration")}</div>
    ),
    enableColumnFilter: true,
    size: 70,
    minSize: 60,
    maxSize: 90,
  },
  {
    accessorKey: "truckType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Truck" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("truckType")}</div>
    ),
    enableColumnFilter: true,
    size: 80,
    minSize: 65,
    maxSize: 100,
  },
  {
    accessorKey: "pickup",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pickup" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("pickup")}</div>
    ),
    enableColumnFilter: true,
    size: 110,
    minSize: 90,
    maxSize: 150,
  },
  {
    accessorKey: "dropoff",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dropoff" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("dropoff")}</div>
    ),
    enableColumnFilter: true,
    size: 110,
    minSize: 90,
    maxSize: 150,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-1">
          <Checkbox checked={row.original.runsheet || false} disabled />
          <span className="text-xs">Runsheet</span>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox checked={row.original.invoiced || false} disabled />
          <span className="text-xs">Invoiced</span>
        </div>
      </div>
    ),
    enableColumnFilter: true,
    size: 90,
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: "comments",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Comments" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("comments")}</div>
    ),
    enableColumnFilter: true,
    size: 120,
    minSize: 100,
    maxSize: 200,
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => (
      <DataTableRowActions 
        row={row} 
        onEdit={onEdit} 
        onDelete={onDelete}
        isLoading={isLoading}
        loadingRowId={loadingRowId}
      />
    ),
    enableSorting: false,
    size: 50,
    minSize: 40,
    maxSize: 60,
  },
]

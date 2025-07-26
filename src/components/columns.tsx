"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkLog } from "@/components/DataTable"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { DataTableRowActions } from "@/components/data-table-row-actions"
import { format } from "date-fns"

export const columns = (
  onEdit: (log: WorkLog) => void,
  onDelete: (log: WorkLog) => void
): ColumnDef<WorkLog>[] => [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("date"))
      return <div className="whitespace-nowrap text-xs">{format(date, "dd/MM")}</div>
    },
    size: 55,
  },
  {
    accessorKey: "driver",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Driver" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[75px] text-xs">{row.getValue("driver")}</div>
    ),
    size: 75,
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[85px] text-xs">{row.getValue("customer")}</div>
    ),
    size: 85,
  },
  {
    accessorKey: "billTo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bill To" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[75px] text-xs">{row.getValue("billTo")}</div>
    ),
    size: 75,
  },
  {
    accessorKey: "registration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reg" />
    ),
    cell: ({ row }) => (
      <div className="font-mono whitespace-nowrap text-xs">{row.getValue("registration")}</div>
    ),
    size: 55,
  },
  {
    accessorKey: "truckType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Truck" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[65px] text-xs">{row.getValue("truckType")}</div>
    ),
    size: 65,
  },
  {
    accessorKey: "pickup",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pickup" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[90px] text-xs">{row.getValue("pickup")}</div>
    ),
    size: 90,
  },
  {
    accessorKey: "dropoff",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dropoff" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[90px] text-xs">{row.getValue("dropoff")}</div>
    ),
    size: 90,
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
    size: 80,
  },
  {
    accessorKey: "comments",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Comments" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[100px] text-xs">{row.getValue("comments")}</div>
    ),
    size: 100,
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => (
      <DataTableRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
    ),
    enableSorting: false,
    size: 40,
  },
]

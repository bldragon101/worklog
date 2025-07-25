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
      return <div>{format(date, "dd/MM")}</div>
    },
  },
  {
    accessorKey: "driver",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Driver" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("driver")}</div>
    ),
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("customer")}</div>
    ),
  },
  {
    accessorKey: "billTo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bill To" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("billTo")}</div>
    ),
  },
  {
    accessorKey: "registration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registration" />
    ),
    cell: ({ row }) => (
      <div className="font-mono">{row.getValue("registration")}</div>
    ),
  },
  {
    accessorKey: "truckType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Truck Type" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("truckType")}</div>
    ),
  },
  {
    accessorKey: "pickup",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pick up" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("pickup")}</div>
    ),
  },
  {
    accessorKey: "dropoff",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Drop off" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("dropoff")}</div>
    ),
  },
  {
    accessorKey: "runsheet",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Runsheet" />
    ),
    cell: ({ row }) => (
      <Checkbox checked={row.original.runsheet || false} disabled />
    ),
  },
  {
    accessorKey: "invoiced",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoiced" />
    ),
    cell: ({ row }) => (
      <Checkbox checked={row.original.invoiced || false} disabled />
    ),
  },
  {
    accessorKey: "comments",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Comments" />
    ),
    cell: ({ row }) => (
      <div>{row.getValue("comments")}</div>
    ),
  },
  {
    id: "actions",
    header: () => <div>Actions</div>,
    cell: ({ row }) => (
      <DataTableRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
    ),
    enableSorting: false,
  },
]

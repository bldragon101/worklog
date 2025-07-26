"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { DataTableRowActions } from "@/components/data-table-row-actions"

export type Customer = {
  id: number;
  customer: string;
  billTo: string;
  contact: string;
  email: string;
  phoneNumber: string;
  tray: number | null;
  crane: number | null;
  semi: number | null;
  semiCrane: number | null;
  fuelLevy: number | null; // 5, 10, or 15
  tolls: boolean;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
};

export const customerColumns = (
  onEdit: (customer: Customer) => void,
  onDelete: (customer: Customer) => void
): ColumnDef<Customer>[] => [
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[100px] text-xs">{row.getValue("customer")}</div>
    ),
    size: 100,
  },
  {
    accessorKey: "billTo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bill To" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[85px] text-xs">{row.getValue("billTo")}</div>
    ),
    size: 85,
  },
  {
    accessorKey: "contact",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[80px] text-xs">{row.getValue("contact")}</div>
    ),
    size: 80,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[120px] text-xs">{row.getValue("email")}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "phoneNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => (
      <div className="font-mono whitespace-nowrap text-xs">{row.getValue("phoneNumber")}</div>
    ),
    size: 90,
  },
  {
    accessorKey: "tray",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tray" />
    ),
    cell: ({ row }) => (
      <div className="text-xs font-mono">
        {row.original.tray ? `$${row.original.tray.toLocaleString()}` : "N/A"}
      </div>
    ),
    size: 70,
  },
  {
    accessorKey: "crane",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Crane" />
    ),
    cell: ({ row }) => (
      <div className="text-xs font-mono">
        {row.original.crane ? `$${row.original.crane.toLocaleString()}` : "N/A"}
      </div>
    ),
    size: 70,
  },
  {
    accessorKey: "semi",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Semi" />
    ),
    cell: ({ row }) => (
      <div className="text-xs font-mono">
        {row.original.semi ? `$${row.original.semi.toLocaleString()}` : "N/A"}
      </div>
    ),
    size: 70,
  },
  {
    accessorKey: "semiCrane",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Semi Crane" />
    ),
    cell: ({ row }) => (
      <div className="text-xs font-mono">
        {row.original.semiCrane ? `$${row.original.semiCrane.toLocaleString()}` : "N/A"}
      </div>
    ),
    size: 90,
  },
  {
    accessorKey: "fuelLevy",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fuel Levy" />
    ),
    cell: ({ row }) => (
      <div className="text-xs">{row.original.fuelLevy ? `${row.original.fuelLevy}%` : "N/A"}</div>
    ),
    size: 70,
  },
  {
    accessorKey: "tolls",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tolls" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Checkbox checked={row.original.tolls} disabled />
        <span className="text-xs">{row.original.tolls ? "Yes" : "No"}</span>
      </div>
    ),
    size: 60,
  },
  {
    accessorKey: "comments",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Comments" />
    ),
    cell: ({ row }) => (
      <div className="break-words max-w-[100px] text-xs">{row.getValue("comments") || ""}</div>
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

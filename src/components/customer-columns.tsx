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
  onDelete: (customer: Customer) => void,
  isLoading?: boolean,
  loadingRowId?: number | null
): ColumnDef<Customer>[] => [
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("customer")}</div>
    ),
    size: 120,
    minSize: 100,
    maxSize: 200,
  },
  {
    accessorKey: "billTo",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bill To" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("billTo")}</div>
    ),
    size: 100,
    minSize: 80,
    maxSize: 150,
  },
  {
    accessorKey: "contact",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("contact")}</div>
    ),
    size: 100,
    minSize: 80,
    maxSize: 150,
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
    size: 80,
    minSize: 70,
    maxSize: 100,
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
    size: 80,
    minSize: 70,
    maxSize: 100,
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
    size: 80,
    minSize: 70,
    maxSize: 100,
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
    size: 100,
    minSize: 90,
    maxSize: 120,
  },
  {
    accessorKey: "fuelLevy",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fuel Levy" />
    ),
    cell: ({ row }) => (
      <div className="text-xs">{row.original.fuelLevy ? `${row.original.fuelLevy}%` : "N/A"}</div>
    ),
    size: 80,
    minSize: 70,
    maxSize: 100,
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
    size: 70,
    minSize: 60,
    maxSize: 80,
  },
  {
    accessorKey: "comments",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Comments" />
    ),
    cell: ({ row }) => (
      <div className="break-words text-xs">{row.getValue("comments") || ""}</div>
    ),
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
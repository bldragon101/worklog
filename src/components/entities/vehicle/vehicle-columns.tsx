"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/data-table/components/data-table-column-header"
import { DataTableRowActions } from "@/components/data-table/components/data-table-row-actions"
import { Badge } from "@/components/ui/badge"
import { Vehicle } from "@/lib/types"

export type { Vehicle }

const getTypeColor = (type: string) => {
  switch (type.toUpperCase()) {
    case 'UTE':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'TRAY':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'CRANE':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'SEMI':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'SEMI CRANE':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'TRAILER':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

export const vehicleColumns = (
  onEdit: (vehicle: Vehicle) => void,
  onDelete: (vehicle: Vehicle) => void
): ColumnDef<Vehicle, unknown>[] => [
  {
    accessorKey: "registration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registration" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("registration")}</div>
    ),
    enableColumnFilter: true,
    size: 120,
    minSize: 100,
    maxSize: 150,
  },
  {
    accessorKey: "expiryDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expiry Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("expiryDate"));
      const isExpired = date < new Date();
      const isExpiringSoon = date < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      return (
        <div className={`font-mono text-s ${isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-orange-600 font-medium' : 'text-foreground'}`}>
          {date.toLocaleDateString()}
        </div>
      );
    },
    enableColumnFilter: true,
    size: 100,
    minSize: 90,
    maxSize: 120,
  },
  {
    accessorKey: "make",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Make" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("make")}</div>
    ),
    enableColumnFilter: true,
    size: 80,
    minSize: 70,
    maxSize: 100,
  },
  {
    accessorKey: "model",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("model")}</div>
    ),
    enableColumnFilter: true,
    size: 100,
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: "yearOfManufacture",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Year" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("yearOfManufacture")}</div>
    ),
    enableColumnFilter: true,
    size: 70,
    minSize: 60,
    maxSize: 80,
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return (
        <Badge className={`font-mono text-s ${getTypeColor(type)}`}>
          {type}
        </Badge>
      );
    },
    enableColumnFilter: true,
    size: 100,
    minSize: 80,
    maxSize: 120,
  },
  {
    accessorKey: "carryingCapacity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Capacity" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("carryingCapacity") || "N/A"}</div>
    ),
    enableColumnFilter: true,
    size: 80,
    minSize: 70,
    maxSize: 100,
  },
  {
    accessorKey: "trayLength",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tray Length" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("trayLength") || "N/A"}</div>
    ),
    enableColumnFilter: true,
    size: 80,
    minSize: 70,
    maxSize: 100,
  },
  {
    accessorKey: "craneReach",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Crane Reach" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("craneReach") || "N/A"}</div>
    ),
    enableColumnFilter: true,
    size: 90,
    minSize: 80,
    maxSize: 110,
  },
  {
    accessorKey: "craneType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Crane Type" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("craneType") || "N/A"}</div>
    ),
    enableColumnFilter: true,
    size: 90,
    minSize: 80,
    maxSize: 110,
  },
  {
    accessorKey: "craneCapacity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Crane Capacity" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("craneCapacity") || "N/A"}</div>
    ),
    enableColumnFilter: true,
    size: 100,
    minSize: 90,
    maxSize: 120,
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => (
      <DataTableRowActions 
        row={row.original} 
        onEdit={onEdit} 
        onDelete={onDelete}
      />
    ),
    enableSorting: false,
    size: 50,
    minSize: 40,
    maxSize: 60,
  },
]
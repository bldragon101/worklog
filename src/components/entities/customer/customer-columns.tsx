"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/components/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/components/data-table-row-actions";
import { Customer } from "@/lib/types";

export type { Customer };

export const customerColumns = (
  onEdit: (customer: Customer) => void,
  onDelete: (customer: Customer) => Promise<void>,
  onMultiDelete?: (customers: Customer[]) => Promise<void>,
): ColumnDef<Customer, unknown>[] => {
  const columns: ColumnDef<Customer, unknown>[] = [
    {
      accessorKey: "customer",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">{row.getValue("customer")}</div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">{row.getValue("billTo")}</div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">{row.getValue("contact")}</div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">
          {row.original.tray ? `$${row.original.tray.toLocaleString()}` : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">
          {row.original.crane
            ? `$${row.original.crane.toLocaleString()}`
            : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">
          {row.original.semi ? `$${row.original.semi.toLocaleString()}` : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">
          {row.original.semiCrane
            ? `$${row.original.semiCrane.toLocaleString()}`
            : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
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
        <div className="font-mono text-s">
          {row.original.fuelLevy ? `${row.original.fuelLevy}%` : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
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
          <span className="font-mono text-s">
            {row.original.tolls ? "Yes" : "No"}
          </span>
        </div>
      ),
      enableColumnFilter: true,
      size: 70,
      minSize: 60,
      maxSize: 80,
    },
    {
      accessorKey: "breakDeduction",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Break Deduction" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">
          {row.original.breakDeduction
            ? `${row.original.breakDeduction}h`
            : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
      size: 120,
      minSize: 100,
      maxSize: 150,
    },
    {
      accessorKey: "comments",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Comments" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">{row.getValue("comments") || ""}</div>
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
          row={row.original}
          onEdit={onEdit}
          onDelete={onDelete}
          getItemName={(customer) => customer.customer}
          deleteTitle="Delete Customer"
          deleteDescription="This will permanently remove this customer and all associated data."
        />
      ),
      enableSorting: false,
      size: 50,
      minSize: 40,
      maxSize: 60,
    },
  ];

  // Add select column as first column if onMultiDelete is provided and not already present
  if (onMultiDelete && !columns.some((col) => col.id === "select")) {
    columns.unshift({
      id: "select",
      header: ({ table }) => (
        <div className="flex justify-center items-center">
          <Checkbox
            id="select-all-customers-checkbox"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all customers"
            className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex justify-center items-center">
          <Checkbox
            id={`select-customer-${row.id}-checkbox`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select customer"
            className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
      minSize: 30,
      maxSize: 50,
    });
  }

  return columns;
};

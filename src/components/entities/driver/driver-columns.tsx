"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table/components/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/components/data-table-row-actions";
import { Driver } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export type { Driver };

export const driverColumns = (
  onEdit: (driver: Driver) => void,
  onDelete: (driver: Driver) => Promise<void>,
  onMultiDelete?: (drivers: Driver[]) => Promise<void>,
): ColumnDef<Driver, unknown>[] => {
  const columns: ColumnDef<Driver, unknown>[] = [
    {
      accessorKey: "driver",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Driver" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">{row.getValue("driver")}</div>
      ),
      enableColumnFilter: true,
      size: 120,
      minSize: 100,
      maxSize: 200,
    },
    {
      accessorKey: "truck",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Truck" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">{row.getValue("truck")}</div>
      ),
      enableColumnFilter: true,
      size: 100,
      minSize: 80,
      maxSize: 150,
    },
    {
      accessorKey: "tray",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tray ($)" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">
          {row.original.tray
            ? `$${Number(row.original.tray).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "N/A"}
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
        <DataTableColumnHeader column={column} title="Crane ($)" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">
          {row.original.crane
            ? `$${Number(row.original.crane).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        <DataTableColumnHeader column={column} title="Semi ($)" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">
          {row.original.semi
            ? `$${Number(row.original.semi).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "N/A"}
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
        <DataTableColumnHeader column={column} title="Semi Crane ($)" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">
          {row.original.semiCrane
            ? `$${Number(row.original.semiCrane).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
      size: 100,
      minSize: 90,
      maxSize: 120,
    },
    {
      accessorKey: "breaks",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Breaks" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-s">
          {row.original.breaks ? `${row.original.breaks}h` : "N/A"}
        </div>
      ),
      enableColumnFilter: true,
      size: 80,
      minSize: 70,
      maxSize: 100,
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const typeVariant =
          row.original.type === "Employee"
            ? "default"
            : row.original.type === "Contractor"
              ? "secondary"
              : "outline";
        return <Badge variant={typeVariant}>{row.original.type}</Badge>;
      },
      enableColumnFilter: true,
      filterFn: (row, id, value) => {
        const rowValue = row.getValue(id) as string;
        if (Array.isArray(value)) {
          return value.includes(rowValue);
        }
        return rowValue === value;
      },
      size: 100,
      minSize: 80,
      maxSize: 120,
    },
    {
      accessorKey: "tolls",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tolls" />
      ),
      cell: ({ row }) => {
        if (row.original.type !== "Subcontractor") {
          return (
            <div className="font-mono text-s text-muted-foreground">N/A</div>
          );
        }
        return (
          <div className="flex items-center gap-1">
            <Checkbox checked={row.original.tolls} disabled />
            <span className="font-mono text-s">
              {row.original.tolls ? "Yes" : "No"}
            </span>
          </div>
        );
      },
      enableColumnFilter: true,
      size: 70,
      minSize: 60,
      maxSize: 80,
    },
    {
      accessorKey: "fuelLevy",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Fuel Levy" />
      ),
      cell: ({ row }) => {
        if (row.original.type !== "Subcontractor") {
          return (
            <div className="font-mono text-s text-muted-foreground">N/A</div>
          );
        }
        return (
          <div className="font-mono text-s">
            {row.original.fuelLevy ? `${row.original.fuelLevy}%` : "N/A"}
          </div>
        );
      },
      enableColumnFilter: true,
      size: 80,
      minSize: 70,
      maxSize: 100,
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <DataTableRowActions
          row={row.original}
          onEdit={onEdit}
          onDelete={onDelete}
          getItemName={(driver) => driver.driver}
          deleteTitle="Delete Driver"
          deleteDescription="This will permanently remove this driver and all associated data."
        />
      ),
      enableSorting: false,
      size: 50,
      minSize: 40,
      maxSize: 60,
    },
  ];

  // Insert select column at the start if onMultiDelete is provided
  if (onMultiDelete) {
    columns.unshift({
      id: "select",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-center items-center">
          <Checkbox
            id={`select-driver-${row.id}-checkbox`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select driver"
            className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
      minSize: 36,
      maxSize: 36,
    });
  }

  return columns;
};

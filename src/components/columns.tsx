"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { WorkLog } from "@/components/DataTable"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTableRowActions } from "@/components/data-table-row-actions"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { useState } from "react"

export const columns = (
  onEdit: (log: WorkLog) => void,
  onDelete: (log: WorkLog) => void,
  isLoading?: boolean,
  loadingRowId?: number | null,
  onUpdateStatus?: (id: number, field: 'runsheet' | 'invoiced', value: boolean) => Promise<void>
): ColumnDef<WorkLog, unknown>[] => [
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
    cell: ({ row }) => {
      const StatusCheckboxes = () => {
        const [loadingStates, setLoadingStates] = useState<{
          runsheet: boolean;
          invoiced: boolean;
        }>({ runsheet: false, invoiced: false });

        const handleRunsheetChange = async (checked: boolean | 'indeterminate') => {
          if (onUpdateStatus && typeof checked === 'boolean') {
            setLoadingStates(prev => ({ ...prev, runsheet: true }));
            try {
              await onUpdateStatus(row.original.id, 'runsheet', checked);
            } finally {
              setLoadingStates(prev => ({ ...prev, runsheet: false }));
            }
          }
        };

        const handleInvoicedChange = async (checked: boolean | 'indeterminate') => {
          if (onUpdateStatus && typeof checked === 'boolean') {
            setLoadingStates(prev => ({ ...prev, invoiced: true }));
            try {
              await onUpdateStatus(row.original.id, 'invoiced', checked);
            } finally {
              setLoadingStates(prev => ({ ...prev, invoiced: false }));
            }
          }
        };

        return (
          <div className="grid grid-cols-1 grid-rows-2 h-full w-full min-h-[2.5rem]">
            {/* Runsheet Row */}
            <div className="grid grid-cols-[auto_1fr] items-center border-b border-border/50 pr-1 group hover:bg-muted/30 transition-colors min-h-[1.25rem]">
              <div className="flex items-center justify-center w-5 h-5 border-r border-border/50">
                {loadingStates.runsheet ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />
                ) : (
                  <Checkbox 
                    checked={row.original.runsheet === true} 
                    onCheckedChange={handleRunsheetChange}
                    disabled={!onUpdateStatus || loadingStates.runsheet || loadingStates.invoiced}
                    className="transition-all duration-200 hover:scale-110 hover:shadow-md cursor-pointer data-[disabled]:cursor-not-allowed w-2.5 h-2.5"
                  />
                )}
              </div>
              <span className="text-xs pl-1.5 group-hover:text-blue-600 transition-colors cursor-pointer select-none leading-none">
                Runsheet
              </span>
            </div>
            
            {/* Invoiced Row */}
            <div className="grid grid-cols-[auto_1fr] items-center pr-1 group hover:bg-muted/30 transition-colors min-h-[1.25rem]">
              <div className="flex items-center justify-center w-5 h-5 border-r border-border/50">
                {loadingStates.invoiced ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-500" />
                ) : (
                  <Checkbox 
                    checked={row.original.invoiced === true} 
                    onCheckedChange={handleInvoicedChange}
                    disabled={!onUpdateStatus || loadingStates.runsheet || loadingStates.invoiced}
                    className="transition-all duration-200 hover:scale-110 hover:shadow-md cursor-pointer data-[disabled]:cursor-not-allowed w-2.5 h-2.5"
                  />
                )}
              </div>
              <span className="text-xs pl-1.5 group-hover:text-blue-600 transition-colors cursor-pointer select-none leading-none">
                Invoiced
              </span>
            </div>
          </div>
        );
      };

      return <StatusCheckboxes />;
    },
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

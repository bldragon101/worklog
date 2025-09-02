"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Job } from "@/lib/types"
import { DataTableColumnHeader } from "@/components/data-table/components/data-table-column-header"
import { JobRowActions } from "./job-row-actions"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { useState } from "react"


export const jobColumns = (
  onEdit: (job: Job) => void,
  onDelete: (job: Job) => void,
  isLoading?: boolean,
  onUpdateStatus?: (id: number, field: 'runsheet' | 'invoiced', value: boolean) => Promise<void>,
  onAttach?: (job: Job) => void
): ColumnDef<Job, unknown>[] => [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("date"))
      return (
        <div className="font-mono text-xs">
          <div>{format(date, "dd/MM")}</div>
          <div className="text-muted-foreground text-[10px]">{format(date, "EEE")}</div>
        </div>
      )
    },
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string
      if (!rowValue) return false
      // Normalize date to YYYY-MM-DD format for consistent filtering
      const normalizedDate = format(new Date(rowValue), 'yyyy-MM-dd')
      if (Array.isArray(value)) {
        return value.includes(normalizedDate)
      }
      return normalizedDate === value
    },
    size: 80,
    minSize: 70,
    maxSize: 90,
  },
  {
    accessorKey: "driver",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Driver" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.getValue("driver")}</div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue)
      }
      return rowValue === value
    },
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
      <div className="font-mono text-s">{row.getValue("customer")}</div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue)
      }
      return rowValue === value
    },
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
      <div className="font-mono text-s">{row.getValue("billTo")}</div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue)
      }
      return rowValue === value
    },
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
      <div className="font-mono text-s">{row.getValue("registration")}</div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue)
      }
      return rowValue === value
    },
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
      <div className="font-mono text-s">{row.getValue("truckType")}</div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as string
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue)
      }
      return rowValue === value
    },
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
      <div className="font-mono text-xs">{row.getValue("pickup")}</div>
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
      <div className="font-mono text-xs">{row.getValue("dropoff")}</div>
    ),
    enableColumnFilter: true,
    size: 110,
    minSize: 90,
    maxSize: 150,
  },
  {
    accessorKey: "runsheet",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Runsheet" />
    ),
    cell: ({ row }) => (
      <div className="text-center">
        {row.original.runsheet ? "Yes" : "No"}
      </div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as boolean
      if (Array.isArray(value)) {
        return value.includes(rowValue ? "true" : "false")
      }
      return (rowValue ? "true" : "false") === value
    },
    size: 80,
    minSize: 70,
    maxSize: 100,
    meta: {
      hidden: true,
    },
  },
  {
    accessorKey: "invoiced",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoiced" />
    ),
    cell: ({ row }) => (
      <div className="text-center">
        {row.original.invoiced ? "Yes" : "No"}
      </div>
    ),
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as boolean
      if (Array.isArray(value)) {
        return value.includes(rowValue ? "true" : "false")
      }
      return (rowValue ? "true" : "false") === value
    },
    size: 80,
    minSize: 70,
    maxSize: 100,
    meta: {
      hidden: true,
    },
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
          <div className="flex flex-col h-full w-full min-h-[2rem] max-w-full" data-status-column>
            {/* Runsheet Row */}
            <div className="flex items-center border-b border-border/50 pr-0.5 group hover:bg-muted/30 transition-colors min-h-[1rem] max-w-full">
              <div 
                id={`runsheet-checkbox-${row.original.id}`}
                className={`w-5 h-4 border-r border-border/50 cursor-pointer hover:bg-muted/80 dark:hover:bg-muted/50 transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                  row.original.runsheet 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background border-input'
                } ${
                  loadingStates.runsheet || loadingStates.invoiced 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!loadingStates.runsheet && !loadingStates.invoiced && onUpdateStatus) {
                    handleRunsheetChange(!row.original.runsheet);
                  }
                }}
              >
                {loadingStates.runsheet ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                ) : row.original.runsheet ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                ) : null}
              </div>
              <span 
                id={`runsheet-label-${row.original.id}`}
                className="text-xs pl-1 group-hover:text-blue-600 transition-colors cursor-pointer select-none leading-none font-mono truncate flex-1 min-w-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!loadingStates.runsheet && !loadingStates.invoiced && onUpdateStatus) {
                    handleRunsheetChange(!row.original.runsheet);
                  }
                }}
              >
                Runsheet
              </span>
            </div>
            
            {/* Invoiced Row */}
            <div className="flex items-center pr-0.5 group hover:bg-muted/30 transition-colors min-h-[1rem] max-w-full">
              <div 
                id={`invoiced-checkbox-${row.original.id}`}
                className={`w-5 h-4 border-r border-border/50 cursor-pointer hover:bg-muted/80 dark:hover:bg-muted/50 transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                  row.original.invoiced 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background border-input'
                } ${
                  loadingStates.invoiced || loadingStates.runsheet 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!loadingStates.invoiced && !loadingStates.runsheet && onUpdateStatus) {
                    handleInvoicedChange(!row.original.invoiced);
                  }
                }}
              >
                {loadingStates.invoiced ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                ) : row.original.invoiced ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                ) : null}
              </div>
              <span 
                id={`invoiced-label-${row.original.id}`}
                className="text-xs pl-1 group-hover:text-blue-600 transition-colors cursor-pointer select-none leading-none font-mono truncate flex-1 min-w-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!loadingStates.invoiced && !loadingStates.runsheet && onUpdateStatus) {
                    handleInvoicedChange(!row.original.invoiced);
                  }
                }}
              >
                Invoiced
              </span>
            </div>
          </div>
        );
      };

      return <StatusCheckboxes />;
    },
    enableColumnFilter: true,
    size: 100,
    minSize: 90,
    maxSize: 130,
  },
  {
    accessorKey: "startTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start" />
    ),
    cell: ({ row }) => {
      const startTime = row.getValue("startTime") as string | null;
      return (
        <div className="font-mono text-sm text-center">
          {startTime ? new Date(startTime).toLocaleTimeString('en-GB', {timeZone: 'Australia/Melbourne', hour12: false}).slice(0, 5) : ""}
        </div>
      );
    },
    enableColumnFilter: false,
    size: 70,
    minSize: 60,
    maxSize: 80,
  },
  {
    accessorKey: "finishTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Finish" />
    ),
    cell: ({ row }) => {
      const finishTime = row.getValue("finishTime") as string | null;
      return (
        <div className="font-mono text-sm text-center">
          {finishTime ? new Date(finishTime).toLocaleTimeString('en-GB', {timeZone: 'Australia/Melbourne', hour12: false}).slice(0, 5) : ""}
        </div>
      );
    },
    enableColumnFilter: false,
    size: 70,
    minSize: 60,
    maxSize: 80,
  },
  {
    accessorKey: "chargedHours",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hours" />
    ),
    cell: ({ row }) => {
      const hours = row.getValue("chargedHours") as number | null;
      return (
        <div className="font-mono text-sm text-right">
          {hours ? hours.toFixed(2) : ""}
        </div>
      );
    },
    enableColumnFilter: true,
    size: 70,
    minSize: 60,
    maxSize: 80,
  },
  {
    accessorKey: "driverCharge",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Driver Charge" />
    ),
    cell: ({ row }) => {
      const charge = row.getValue("driverCharge") as number | null;
      return (
        <div className="font-mono text-sm text-right">
          {charge ? `${charge.toFixed(2)}` : ""}
        </div>
      );
    },
    enableColumnFilter: true,
    size: 110,
    minSize: 90,
    maxSize: 100,
    meta: {
      hidden: true,
    },
  },
  {
    accessorKey: "jobReference",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job Ref" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs">{row.getValue("jobReference") || ""}</div>
    ),
    enableColumnFilter: true,
    size: 90,
    minSize: 75,
    maxSize: 120,
  },
  {
    accessorKey: "eastlink",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Eastlink" />
    ),
    cell: ({ row }) => {
      const count = row.getValue("eastlink") as number | null;
      return (
        <div className="font-mono text-sm text-center">
          {count && count > 0 ? count : ""}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as number | null
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue.toString())
      }
      return rowValue.toString() === value
    },
    size: 80,
    minSize: 70,
    maxSize: 90,
    meta: {
      hidden: true,
    },
  },
  {
    accessorKey: "citylink",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Citylink" />
    ),
    cell: ({ row }) => {
      const count = row.getValue("citylink") as number | null;
      return (
        <div className="font-mono text-sm text-center">
          {count && count > 0 ? count : ""}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const rowValue = row.getValue(id) as number | null
      if (!rowValue) return false
      if (Array.isArray(value)) {
        return value.includes(rowValue.toString())
      }
      return rowValue.toString() === value
    },
    size: 80,
    minSize: 70,
    maxSize: 90,
    meta: {
      hidden: true,
    },
  },
  {
    accessorKey: "tolls",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tolls" />
    ),
    cell: ({ row }) => {
      const eastlink = row.original.eastlink || 0;
      const citylink = row.original.citylink || 0;
      
      const hasEastlink = eastlink > 0;
      const hasCitylink = citylink > 0;
      const hasAnyTolls = hasEastlink || hasCitylink;
      
      if (!hasAnyTolls) {
        return <div className="h-full w-full min-h-[2rem]"></div>;
      }
      
      return (
        <div className="flex flex-col h-full w-full min-h-[2rem] max-w-full" data-tolls-column>
          {/* Eastlink Row - only show if has value */}
          {hasEastlink && (
            <div className={`flex items-center pr-0.5 min-h-[1rem] max-w-full ${hasCitylink ? 'border-b border-border/50' : ''}`}>
              <div 
                className="w-5 h-4 border-r border-border/50 flex items-center justify-center flex-shrink-0 bg-background"
              >
                <span className="text-xs font-mono">{eastlink}</span>
              </div>
              <span className="text-xs pl-1 font-mono truncate flex-1 min-w-0">
                Eastlink
              </span>
            </div>
          )}
          
          {/* Citylink Row - only show if has value */}
          {hasCitylink && (
            <div className="flex items-center pr-0.5 min-h-[1rem] max-w-full">
              <div 
                className="w-5 h-4 border-r border-border/50 flex items-center justify-center flex-shrink-0 bg-background"
              >
                <span className="text-xs font-mono">{citylink}</span>
              </div>
              <span className="text-xs pl-1 font-mono truncate flex-1 min-w-0">
                Citylink
              </span>
            </div>
          )}
        </div>
      );
    },
    enableColumnFilter: false,
    enableSorting: false,
    size: 100,
    minSize: 90,
    maxSize: 130,
  },
  {
    accessorKey: "comments",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Comments" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs">{row.getValue("comments")}</div>
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
      <JobRowActions 
        row={row.original} 
        onEdit={onEdit} 
        onDelete={onDelete}
        onAttach={onAttach}
      />
    ),
    enableSorting: false,
    size: 50,
    minSize: 40,
    maxSize: 60,
  },
]

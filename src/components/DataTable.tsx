"use client";
import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Row,
  RowData,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { Check, X, Pencil, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {}
}

export type WorkLog = {
  id: number;
  date: string;
  driver: string;
  customer: string;
  billTo: string;
  registration: string;
  truckType: string;
  pickup: string;
  dropoff: string;
  runsheet: boolean | null;
  invoiced: boolean | null;
  chargedHours: number | null;
  driverCharge: number | null;
  comments: string | null;
};

type DataTableProps = {
  data: WorkLog[];
  onEdit: (row: WorkLog) => void;
  onDelete: (logId: number) => void;
  expandedRows: Set<number>;
  toggleExpand: (rowId: number) => void;
};

function getDateObj(dateStr: string | undefined) {
  if (!dateStr) return undefined;
  try {
    return parseISO(dateStr);
  } catch {
    return undefined;
  }
}

export function DataTable({
  data,
  onEdit,
  onDelete,
  expandedRows,
  toggleExpand,
}: DataTableProps) {
  const columns = React.useMemo<ColumnDef<WorkLog>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => toggleExpand(row.original.id)}
            className="w-8 h-8"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                expandedRows.has(row.original.id) ? "rotate-180" : ""
              )}
            />
          </Button>
        ),
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          row.original.date && getDateObj(row.original.date)
            ? format(getDateObj(row.original.date) as Date, "dd-MM-yyyy")
            : ""
        ),
      },
      {
        accessorKey: "driver",
        header: "Driver",
        cell: ({ row }) => row.original.driver,
      },
      {
        accessorKey: "customer",
        header: "Customer",
        cell: ({ row }) => row.original.customer,
      },
      {
        accessorKey: "billTo",
        header: "Bill To",
        cell: ({ row }) => row.original.billTo,
      },
      {
        accessorKey: "registration",
        header: "Registration",
        cell: ({ row }) => row.original.registration,
      },
      {
        accessorKey: "truckType",
        header: "Truck Type",
        cell: ({ row }) => row.original.truckType,
      },
      {
        accessorKey: "pickup",
        header: "Pick up",
        cell: ({ row }) => row.original.pickup,
      },
      {
        accessorKey: "dropoff",
        header: "Drop off",
        cell: ({ row }) => row.original.dropoff,
      },
      {
        accessorKey: "runsheet",
        header: "Runsheet",
        cell: ({ row }) => <input type="checkbox" checked={row.original.runsheet || false} readOnly />,
      },
      {
        accessorKey: "invoiced",
        header: "Invoiced",
        cell: ({ row }) => <input type="checkbox" checked={row.original.invoiced || false} readOnly />,
      },
      {
        accessorKey: "comments",
        header: "Comments",
        cell: ({ row }) => row.original.comments,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2 justify-center">
            <Button size="icon" variant="outline" className="hover:bg-blue-100 dark:hover:bg-blue-900/40" onClick={() => onEdit(row.original)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button>
            <Button size="icon" variant="destructive" className="hover:bg-red-100 dark:hover:bg-red-900/40" onClick={() => onDelete(row.original.id)} aria-label="Delete"><Trash2 className="w-4 h-4 text-red-500" /></Button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete, toggleExpand, expandedRows]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-2xl shadow-2xl bg-white/90 dark:bg-black/80 border border-gray-200 dark:border-neutral-800 overflow-x-auto">
      <Table className="w-full text-sm text-left text-gray-900 dark:text-white">
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow
              key={headerGroup.id}
              className="border-b-2 border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-900"
            >
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider align-top"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <React.Fragment key={row.original.id}>
              <TableRow
                className={cn(
                  "border-b border-gray-200 dark:border-neutral-800 last:border-none align-top transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
                  row.index % 2 === 0
                    ? "bg-white dark:bg-black"
                    : "bg-slate-50 dark:bg-slate-900"
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="px-6 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {expandedRows.has(row.original.id) && (
                <TableRow className="bg-slate-100 dark:bg-slate-800">
                  <TableCell colSpan={columns.length} className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><strong>Charged Hours:</strong> {row.original.chargedHours}</div>
                      <div><strong>Driver Charge:</strong> {row.original.driverCharge}</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

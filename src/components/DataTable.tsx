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
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    editId: number | null;
    editRow: Partial<WorkLog>;
    setEditRow: (row: Partial<WorkLog>) => void;
    setCalendarOpen: (open: boolean) => void;
    calendarOpen: boolean;
  }
}

export type WorkLog = {
  id: number;
  date: string;
  driver: string;
  customer: string;
  client: string;
  startTime: string;
  finishTime: string;
  truckType: string;
  vehicle: string;
  comments: string;
};

type DataTableProps = {
  data: WorkLog[];
  onEdit: (row: WorkLog) => void;
  onSave: (row: WorkLog) => void;
  onCancel: () => void;
  editId: number | null;
  editRow: Partial<WorkLog>;
  setEditRow: (row: Partial<WorkLog>) => void;
  setCalendarOpen: (open: boolean) => void;
  calendarOpen: boolean;
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
  onSave,
  onCancel,
  editId,
  editRow,
  setEditRow,
  setCalendarOpen,
  calendarOpen,
}: DataTableProps) {
  const columns = React.useMemo<ColumnDef<WorkLog>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Popover open={meta.calendarOpen} onOpenChange={meta.setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={
                    "w-full justify-start text-left font-normal bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-neutral-700"
                  }
                >
                  {meta.editRow.date
                    ? format(getDateObj(meta.editRow.date) ?? new Date(), "dd-MM-yyyy")
                    : <span className="text-gray-400">Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={getDateObj(meta.editRow.date)}
                  onSelect={(date) => {
                    meta.setEditRow({
                      ...meta.editRow,
                      date: date ? format(date, "yyyy-MM-dd") : undefined,
                    });
                    meta.setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            row.original.date && getDateObj(row.original.date)
              ? format(getDateObj(row.original.date) as Date, "dd-MM-yyyy")
              : ""
          );
        },
      },
      {
        accessorKey: "driver",
        header: "Driver",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="driver"
              value={meta.editRow.driver || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, driver: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.driver
          );
        },
      },
      {
        accessorKey: "customer",
        header: "Customer",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="customer"
              value={meta.editRow.customer || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, customer: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.customer
          );
        },
      },
      {
        accessorKey: "client",
        header: "Client",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="client"
              value={meta.editRow.client || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, client: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.client
          );
        },
      },
      {
        accessorKey: "startTime",
        header: "Start Time",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="startTime"
              type="time"
              value={meta.editRow.startTime || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, startTime: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.startTime
          );
        },
      },
      {
        accessorKey: "finishTime",
        header: "Finish Time",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="finishTime"
              type="time"
              value={meta.editRow.finishTime || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, finishTime: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.finishTime
          );
        },
      },
      {
        accessorKey: "truckType",
        header: "Truck Type",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="truckType"
              value={meta.editRow.truckType || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, truckType: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.truckType
          );
        },
      },
      {
        accessorKey: "vehicle",
        header: "Vehicle",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Input
              name="vehicle"
              value={meta.editRow.vehicle || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, vehicle: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            row.original.vehicle
          );
        },
      },
      {
        accessorKey: "comments",
        header: "Comments",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <Textarea
              name="comments"
              value={meta.editRow.comments || ""}
              onChange={e => meta.setEditRow({ ...meta.editRow, comments: e.target.value })}
              className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-400 min-h-[2.5rem] resize-y"
            />
          ) : (
            row.original.comments
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row, table }) => {
          const meta = table.options.meta;
          if (!meta) return null;
          return meta.editId === row.original.id ? (
            <div className="flex gap-2 justify-center">
              <Button size="icon" variant="default" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => onSave(meta.editRow as WorkLog)} aria-label="Save"><Check className="w-4 h-4" /></Button>
              <Button size="icon" variant="destructive" className="bg-red-500 hover:bg-red-600 text-white" onClick={onCancel} aria-label="Cancel"><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex gap-2 justify-center">
              <Button size="icon" variant="outline" className="hover:bg-blue-100 dark:hover:bg-blue-900/40" onClick={() => onEdit(row.original)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button>
            </div>
          );
        },
      },
    ],
    [onEdit, onSave, onCancel]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editId,
      editRow,
      setEditRow,
      setCalendarOpen,
      calendarOpen,
    },
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
            <TableRow
              key={row.original.id}
              className={cn(
                "border-b border-gray-200 dark:border-neutral-800 last:border-none align-top transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
                editId === row.original.id
                  ? "bg-blue-50 dark:bg-blue-950"
                  : row.index % 2 === 0
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 
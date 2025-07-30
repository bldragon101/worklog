"use client"

import * as React from "react"
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ChevronDown, ChevronUp, X } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  Sheet,
  SheetContentWithoutClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"

import { columns } from "./columns"
import { cn } from "@/lib/utils"

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

interface EnhancedDataTableProps {
  data: WorkLog[]
  isLoading: boolean
  onEdit: (log: WorkLog) => void
  onDelete: (log: WorkLog) => void
  loadingRowId?: number | null
  onImportSuccess?: () => void
  onAddEntry?: () => void
  filters?: {
    startDate?: string
    endDate?: string
    customer?: string
    driver?: string
  }
}

export function EnhancedDataTable({ 
  data, 
  isLoading, 
  onEdit, 
  onDelete, 
  loadingRowId, 
  onImportSuccess, 
  onAddEntry,
  filters 
}: EnhancedDataTableProps) {
  // Only hide columns on very small screens (mobile)
  const isMobile = useMediaQuery("(max-width: 767px)")

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const topBarRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  const [topBarHeight, setTopBarHeight] = React.useState(0)

  React.useEffect(() => {
    if (isMobile) {
      // Mobile: Show only essential columns
      setColumnVisibility({
        billTo: false,
        registration: false,
        truckType: false,
        pickup: false,
        dropoff: false,
        runsheet: false,
        invoiced: false,
        comments: false,
      })
    } else {
      // Desktop and tablet: Show all columns with text wrapping
      setColumnVisibility({})
    }
  }, [isMobile])

  React.useEffect(() => {
    const observer = new ResizeObserver(() => {
      const rect = topBarRef.current?.getBoundingClientRect();
      if (rect) {
        setTopBarHeight(rect.height);
      }
    });

    const topBar = topBarRef.current;
    if (!topBar) return;

    observer.observe(topBar);
    return () => observer.unobserve(topBar);
  }, [topBarRef]);

  const tableColumns = React.useMemo(() => columns(onEdit, onDelete, isLoading, loadingRowId), [onEdit, onDelete, isLoading, loadingRowId])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      columnSizing,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enableMultiRowSelection: false,
  })

  // Get selected row
  const selectedRow = React.useMemo(() => {
    const selectedRowKey = Object.keys(rowSelection)?.[0];
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey);
  }, [rowSelection, table]);

  // Navigation functions
  const index = table
    .getCoreRowModel()
    .flatRows.findIndex((row) => row.id === selectedRow?.id);

  const nextId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index + 1]?.id,
    [index, table],
  );

  const prevId = React.useMemo(
    () => table.getCoreRowModel().flatRows[index - 1]?.id,
    [index, table],
  );

  const onPrev = React.useCallback(() => {
    if (prevId) table.setRowSelection({ [prevId]: true });
  }, [prevId, table]);

  const onNext = React.useCallback(() => {
    if (nextId) table.setRowSelection({ [nextId]: true });
  }, [nextId, table]);

  // Keyboard navigation
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!selectedRow) return;

      const activeElement = document.activeElement;
      const isMenuActive = activeElement?.closest('[role="menu"]');

      if (isMenuActive) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [selectedRow, onNext, onPrev]);

  /**
   * Calculate column sizes for CSS variables
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: string } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id.replace(".", "-")}-size`] =
        `${header.getSize()}px`;
      colSizes[`--col-${header.column.id.replace(".", "-")}-size`] =
        `${header.column.getSize()}px`;
    }
    return colSizes;
  }, [
    table.getState().columnSizingInfo,
    table.getState().columnSizing,
    table.getState().columnVisibility,
  ]);

  return (
    <div
      className="flex h-full min-h-screen w-full flex-col sm:flex-row"
      style={
        {
          "--top-bar-height": `${topBarHeight}px`,
          ...columnSizeVars,
        } as React.CSSProperties
      }
    >


      {/* Main Content Area */}
      <div
        className={cn(
          "flex max-w-full flex-1 flex-col",
        )}
      >
        {/* Top Bar */}
        <div
          ref={topBarRef}
          className={cn(
            "flex flex-col gap-4 bg-background p-4 px-8",
            "sticky top-0 z-10 pb-4",
          )}
        >
          <DataTableToolbar 
            table={table} 
            type="worklog"
            onImportSuccess={onImportSuccess}
            onAddEntry={onAddEntry}
            filters={filters}
          />
        </div>

        {/* Table */}
        <div className="z-0">
          <Table
            ref={tableRef}
            className="border-separate border-spacing-0"
            containerClassName="max-h-[calc(100vh_-_var(--top-bar-height))]"
          >
            <TableHeader className={cn("sticky top-0 z-20 bg-background")}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className={cn(
                    "bg-muted/50 hover:bg-muted/50",
                    "[&>*]:border-t [&>:not(:last-child)]:border-r",
                  )}
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                                                  className={cn(
                            "relative select-none truncate border-b border-border [&>.cursor-col-resize]:last:opacity-0",
                          )}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : "none"
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getCanResize() && (
                          <div
                            onDoubleClick={() => header.column.resetSize()}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "user-select-none absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center",
                              "before:absolute before:inset-y-0 before:w-px before:translate-x-px before:bg-border",
                            )}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody
              id="content"
              tabIndex={-1}
              className="outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:outline"
              style={{
                scrollMarginTop: "calc(var(--top-bar-height) + 40px)",
              }}
            >
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center"
                  >
                    Fetching logs...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    id={row.id}
                    tabIndex={0}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => row.toggleSelected()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        row.toggleSelected();
                      }
                    }}
                    className={cn(
                      "[&>:not(:last-child)]:border-r",
                      "outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:bg-muted/50 focus-visible:outline data-[state=selected]:outline",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "truncate border-b border-border",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Details Sheet */}
      <Sheet
        open={!!selectedRow}
        onOpenChange={() => {
          const el = selectedRow?.id
            ? document.getElementById(selectedRow.id)
            : null;
          table.resetRowSelection();
          setTimeout(() => el?.focus(), 0);
        }}
      >
        <SheetContentWithoutClose
          className="overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader className="sticky top-0 z-10 border-b bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="truncate text-left">
                {isLoading && !selectedRow ? (
                  <div className="h-7 w-36 bg-muted animate-pulse rounded" />
                ) : (
                  `Job Details - ${selectedRow?.original.customer}`
                )}
              </SheetTitle>
              <div className="flex h-7 items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={!prevId}
                        onClick={onPrev}
                      >
                        <ChevronUp className="h-5 w-5" />
                        <span className="sr-only">Previous</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Navigate <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">↑</kbd>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={!nextId}
                        onClick={onNext}
                      >
                        <ChevronDown className="h-5 w-5" />
                        <span className="sr-only">Next</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Navigate <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">↓</kbd>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Separator orientation="vertical" className="mx-1" />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7"
                  onClick={() => table.resetRowSelection()}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </div>
          </SheetHeader>
          <SheetDescription className="sr-only">
            Selected row details
          </SheetDescription>
          <div className="p-4">
            {selectedRow && (
              <dl className="divide-y">
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Date</dt>
                  <dd className="font-mono w-full text-right">
                    {new Date(selectedRow.original.date).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Driver</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.driver}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Customer</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.customer}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Bill To</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.billTo}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Registration</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.registration}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Truck Type</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.truckType}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Pickup</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.pickup}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Dropoff</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.dropoff}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Charged Hours</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.chargedHours ?? "N/A"}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Driver Charge</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.driverCharge ?? "N/A"}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Runsheet</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.runsheet ? "Yes" : "No"}
                  </dd>
                </div>
                <div className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full">
                  <dt className="shrink-0 text-muted-foreground">Invoiced</dt>
                  <dd className="font-mono w-full text-right">
                    {selectedRow.original.invoiced ? "Yes" : "No"}
                  </dd>
                </div>
                {selectedRow.original.comments && (
                  <div className="flex gap-4 my-1 py-1 text-sm justify-between items-start w-full">
                    <dt className="shrink-0 text-muted-foreground">Comments</dt>
                    <dd className="font-mono w-full text-right">
                      {selectedRow.original.comments}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </SheetContentWithoutClose>
      </Sheet>
    </div>
  )
} 
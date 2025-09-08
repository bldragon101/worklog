"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { DataTablePagination } from "@/components/data-table/components/data-table-pagination";
import { DataTableRowActions } from "@/components/data-table/components/data-table-row-actions";
import type { SheetField } from "@/components/data-table/core/types";
import { cn } from "@/lib/utils";
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Table as TableType,
} from "@tanstack/react-table";
import * as React from "react";
const { useCallback } = React;
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MemoizedDataTableSheetContent } from "@/components/data-table/sheet/data-table-sheet-content";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/custom/kbd";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, FileCheck } from "lucide-react";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultColumnFilters?: ColumnFiltersState;
  sheetFields?: SheetField<TData, unknown>[];
  onEdit?: (data: TData) => void | Promise<void>;
  onDelete?: (data: TData) => void | Promise<void>;
  onMultiDelete?: (data: TData[]) => void | Promise<void>;
  onMarkAsInvoiced?: (data: TData[]) => void | Promise<void>;
  isLoading?: boolean;
  loadingRowId?: number | null;
  onTableReady?: (table: TableType<TData>) => void;
  tableInstance?: TableType<TData>; // Optional pre-created table instance
}

export function DataTable<TData, TValue>({
  columns,
  data,
  defaultColumnFilters = [],
  sheetFields = [],
  onEdit,
  onDelete,
  onMultiDelete,
  onMarkAsInvoiced,
  isLoading = false,
  loadingRowId,
  onTableReady,
  tableInstance,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  // Initialize column visibility based on column metadata
  const initialVisibility = React.useMemo(() => {
    const visibility: VisibilityState = {};
    columns.forEach((column) => {
      if (
        (column.meta as { hidden?: boolean })?.hidden === true &&
        "accessorKey" in column &&
        column.accessorKey
      ) {
        visibility[column.accessorKey as string] = false;
      }
    });
    return visibility;
  }, [columns]);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialVisibility);

  // State for managing sheet visibility
  const [selectedRow, setSelectedRow] = React.useState<TData | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number>(-1);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Add selection and actions columns
  const enhancedColumns = React.useMemo(() => {
    const hasCustomActions = columns.some((col) => col.id === "actions");
    const hasCustomSelect = columns.some((col) => col.id === "select");

    let finalColumns = [...columns];

    // Add select column at the beginning if multi-delete is supported and not already present
    if (onMultiDelete && !hasCustomSelect) {
      const selectColumn: ColumnDef<TData, TValue> = {
        id: "select",
        header: ({ table }) => (
          <div
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
          >
            <div style={{ transform: "scale(1.5)" }}>
              <Checkbox
                id="select-all-checkbox"
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all rows"
                className="rounded data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>
          </div>
        ),
        cell: ({ row }) => (
          <div
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
          >
            <div style={{ transform: "scale(1.5)" }}>
              <Checkbox
                id={`select-row-${row.id}-checkbox`}
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
                className="rounded data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 48,
        minSize: 48,
        maxSize: 48,
        meta: {
          hidden: false,
        },
      };
      finalColumns = [selectColumn, ...finalColumns];
    }

    // Add generic actions column if edit/delete functions are provided and no custom actions column exists
    if ((onEdit || onDelete) && !hasCustomActions) {
      const actionsColumn: ColumnDef<TData, TValue> = {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DataTableRowActions
            row={row.original}
            onEdit={onEdit || (() => {})}
            onDelete={onDelete || (() => {})}
          />
        ),
      };
      finalColumns = [...finalColumns, actionsColumn];
    }

    return finalColumns;
  }, [columns, onDelete, onEdit, onMultiDelete]);

  // Always call the hook but conditionally use the result
  const internalTable = useReactTable({
    data,
    columns: enhancedColumns,
    getRowId: (row: TData) =>
      (row as { id?: number | string }).id?.toString() || String(Math.random()),
    state: {
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Use provided table instance or the internal one
  const table = tableInstance || internalTable;

  // Call onTableReady when table is ready
  React.useEffect(() => {
    if (onTableReady && table) {
      onTableReady(table);
    }
  }, [table, onTableReady]);

  // Handle row click to open sheet
  const handleRowClick = (rowData: TData, index: number) => {
    setSelectedRow(rowData);
    setSelectedRowIndex(index);
    setIsSheetOpen(true);
  };

  // Navigation functions
  const goToPrevious = useCallback(() => {
    const newIndex = Math.max(0, selectedRowIndex - 1);
    const rows = table.getRowModel().rows;
    if (rows[newIndex]) {
      setSelectedRow(rows[newIndex].original);
      setSelectedRowIndex(newIndex);
    }
  }, [selectedRowIndex, table]);

  const goToNext = useCallback(() => {
    const rows = table.getRowModel().rows;
    const newIndex = Math.min(rows.length - 1, selectedRowIndex + 1);
    if (rows[newIndex]) {
      setSelectedRow(rows[newIndex].original);
      setSelectedRowIndex(newIndex);
    }
  }, [selectedRowIndex, table]);

  const canGoToPrevious = selectedRowIndex > 0;
  const canGoToNext = selectedRowIndex < table.getRowModel().rows.length - 1;

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSheetOpen) return;

      if (e.key === "ArrowLeft" && canGoToPrevious) {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight" && canGoToNext) {
        e.preventDefault();
        goToNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsSheetOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSheetOpen, canGoToPrevious, canGoToNext, goToNext, goToPrevious]);

  // Get selected rows
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;


  // Handle multi-delete
  const handleMultiDelete = async () => {
    if (onMultiDelete && selectedRows.length > 0) {
      const selectedData = selectedRows.map((row) => row.original);
      await onMultiDelete(selectedData);
      table.toggleAllRowsSelected(false); // Clear selection after delete
    }
  };

  // Handle mark as invoiced
  const handleMarkAsInvoiced = async () => {
    if (onMarkAsInvoiced && selectedRows.length > 0) {
      const selectedData = selectedRows.map((row) => row.original);
      await onMarkAsInvoiced(selectedData);
      table.toggleAllRowsSelected(false); // Clear selection after update
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Multi-action toolbar */}
      {selectedCount > 0 && (onMultiDelete || onMarkAsInvoiced) && (
        <div className="m-4">
          <div className="flex items-center justify-between rounded border border-border bg-muted/50 px-6 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} row{selectedCount === 1 ? "" : "s"} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                id="clear-selection-btn"
                variant="ghost"
                size="sm"
                onClick={() => table.toggleAllRowsSelected(false)}
                className="h-7"
              >
                Clear selection
              </Button>
              {onMarkAsInvoiced && (
                <Button
                  id="mark-invoiced-btn"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAsInvoiced}
                  className="h-7 gap-1"
                >
                  <FileCheck className="h-3 w-3" />
                  Mark as Invoiced
                </Button>
              )}
              {onMultiDelete && (
                <Button
                  id="multi-delete-btn"
                  variant="destructive"
                  size="sm"
                  onClick={handleMultiDelete}
                  className="h-7 gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete {selectedCount} item{selectedCount === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto" data-testid="data-table">
        <Table
          className="border-separate border-spacing-0"
          containerClassName="h-full"
        >
          <TableHeader className="sticky top-0 z-20 bg-background">
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
                        "relative select-none truncate border-b border-border",
                        header.column.id === "select" &&
                          "w-12 min-w-[48px] max-w-[48px] p-0",
                        header.column.id === "actions" && "w-10",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {Array.from({ length: Math.min(10, data.length || 8) }).map(
                  (_, rowIndex) => (
                    <TableRow key={rowIndex} className="hover:bg-transparent">
                      {enhancedColumns.map((column, colIndex) => {
                        // Create predictable widths based on column index and row index
                        const baseWidth = 60;
                        const variation = ((rowIndex + colIndex) % 4) * 15;
                        const width =
                          colIndex === 0
                            ? "60px"
                            : colIndex === enhancedColumns.length - 1
                              ? "50px"
                              : `${baseWidth + variation}%`;

                        return (
                          <TableCell
                            key={colIndex}
                            className="border-b border-border p-4"
                          >
                            <div
                              className="animate-pulse bg-muted rounded h-4"
                              style={{ width }}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ),
                )}
              </>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "cursor-pointer hover:bg-muted/80 dark:hover:bg-muted/50",
                    "[&>*:not(:last-child)]:border-r",
                    loadingRowId === (row.original as { id?: number })?.id &&
                      "opacity-50 pointer-events-none",
                    // Bold highlight for selected row when sheet is open (similar to data-table-filters infinite table)
                    isSheetOpen &&
                      index === selectedRowIndex && [
                        "bg-accent/50 hover:bg-accent/60",
                        "outline-1 -outline-offset-1 outline-primary outline transition-colors",
                      ],
                    // Highlight for checkbox selected rows
                    row.getIsSelected() &&
                      !isSheetOpen && [
                        "bg-accent/30 hover:bg-accent/40",
                        "outline-1 -outline-offset-1 outline-primary/60 outline transition-colors",
                      ],
                  )}
                  onClick={(e) => {
                    // Don't trigger row click if clicking on action buttons or status column
                    if (
                      (e.target as HTMLElement).closest(
                        "[data-radix-collection-item]",
                      ) ||
                      (e.target as HTMLElement).closest("button") ||
                      (e.target as HTMLElement).closest("[data-status-column]")
                    ) {
                      return;
                    }
                    handleRowClick(row.original, index);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "border-b border-border",
                        cell.column.id === "select" &&
                          "w-12 min-w-[48px] max-w-[48px] p-0",
                        cell.column.id === "actions" && "w-10 p-0",
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={enhancedColumns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="sticky bottom-0 z-20 shrink-0 bg-background">
        <DataTablePagination table={table} />
      </div>

      {/* Sheet for row details */}
      {sheetFields.length > 0 && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent
            side="right"
            className="w-[400px] sm:w-[540px] p-0"
            hideClose
          >
            {/* Header with navigation */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        id="prev-record-btn"
                        variant="ghost"
                        size="sm"
                        onClick={goToPrevious}
                        disabled={!canGoToPrevious}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="flex items-center gap-1">
                        Previous
                        <Kbd variant="outline">←</Kbd>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        id="next-record-btn"
                        variant="ghost"
                        size="sm"
                        onClick={goToNext}
                        disabled={!canGoToNext}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="flex items-center gap-1">
                        Next
                        <Kbd variant="outline">→</Kbd>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedRowIndex + 1} of {table.getRowModel().rows.length}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        id="close-sheet-btn"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSheetOpen(false)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="flex items-center gap-1">
                        Close
                        <Kbd variant="outline">Esc</Kbd>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Content with proper padding */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedRow && (
                <MemoizedDataTableSheetContent
                  data={selectedRow}
                  table={table}
                  fields={sheetFields}
                  filterFields={[]}
                />
              )}

              {selectedRow && onEdit && (
                <div className="mt-6 pt-4 border-t">
                  <Button
                    id="edit-selected-row-btn"
                    onClick={() => {
                      onEdit(selectedRow);
                      setIsSheetOpen(false);
                    }}
                    className="w-full"
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

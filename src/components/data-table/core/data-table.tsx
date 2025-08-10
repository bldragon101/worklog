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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/custom/kbd";
import { TableLoadingSkeleton } from "@/components/ui/loading-skeleton";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultColumnFilters?: ColumnFiltersState;
  sheetFields?: SheetField<TData, unknown>[];
  onEdit?: (data: TData) => void | Promise<void>;
  onDelete?: (data: TData) => void | Promise<void>;
  isLoading?: boolean;
  loadingRowId?: number | null;
  onTableReady?: (table: TableType<TData>) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  defaultColumnFilters = [],
  sheetFields = [],
  onEdit,
  onDelete,
  isLoading = false,
  loadingRowId,
  onTableReady,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  // Initialize column visibility based on column metadata
  const initialVisibility = React.useMemo(() => {
    const visibility: VisibilityState = {};
    columns.forEach((column) => {
      if ((column.meta as { hidden?: boolean })?.hidden === true && 'accessorKey' in column && column.accessorKey) {
        visibility[column.accessorKey as string] = false;
      }
    });
    return visibility;
  }, [columns]);

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialVisibility);

  // State for managing sheet visibility
  const [selectedRow, setSelectedRow] = React.useState<TData | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number>(-1);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Add actions column if edit/delete functions are provided
  const enhancedColumns = React.useMemo(() => {
    if (!onEdit && !onDelete) return columns;

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

    return [...columns, actionsColumn];
  }, [columns, onDelete, onEdit]);

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    state: { columnFilters, sorting, columnVisibility, pagination },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

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
      
      if (e.key === 'ArrowLeft' && canGoToPrevious) {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight' && canGoToNext) {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsSheetOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSheetOpen, canGoToPrevious, canGoToNext, goToNext, goToPrevious]);

  return (
    <div className="space-y-4">
      <div className="border" data-testid="data-table">
        <Table className="border-separate border-spacing-0">
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className={cn(
                  "hover:bg-muted/50",
                  "[&>*]:border-t [&>:not(:last-child)]:border-r"
                )}
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                      key={header.id}
                      className="border-b border-border"
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
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-transparent">
                    {enhancedColumns.map((column, colIndex) => {
                      // Create predictable widths based on column index and row index
                      const baseWidth = 60;
                      const variation = ((rowIndex + colIndex) % 4) * 15;
                      const width = colIndex === 0 ? '60px' : 
                                   colIndex === enhancedColumns.length - 1 ? '50px' : 
                                   `${baseWidth + variation}%`;
                      
                      return (
                        <TableCell key={colIndex} className="border-b border-border p-4">
                          <div 
                            className="animate-pulse bg-muted rounded h-4" 
                            style={{ width }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    "[&>:not(:last-child)]:border-r",
                    loadingRowId === (row.original as { id?: number })?.id && 
                    "opacity-50 pointer-events-none"
                  )}
                  onClick={(e) => {
                    // Don't trigger row click if clicking on action buttons or status column
                    if ((e.target as HTMLElement).closest('[data-radix-collection-item]') || 
                        (e.target as HTMLElement).closest('button') ||
                        (e.target as HTMLElement).closest('[data-status-column]')) {
                      return;
                    }
                    handleRowClick(row.original, index);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      className="border-b border-border"
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
      <DataTablePagination table={table} />
      
      {/* Sheet for row details */}
      {sheetFields.length > 0 && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0" hideClose>
            {/* Header with navigation */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
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
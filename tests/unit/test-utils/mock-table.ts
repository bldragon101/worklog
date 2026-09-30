import type { ColumnVisibilityState, RowData } from "@tanstack/react-table";
import type { DataTableInstance } from "@/components/data-table/core/table-features";

interface MockTableOptions {
  columnVisibility: ColumnVisibilityState;
  setColumnVisibility: vi.Mock;
  columns?: Array<{
    id: string;
    accessorKey?: string;
    accessorFn?: () => unknown;
    getCanHide: () => boolean;
  }>;
}

export function createMockTable<TData extends RowData = Record<string, unknown>>({
  columnVisibility,
  setColumnVisibility,
  columns,
}: MockTableOptions): DataTableInstance<TData> {
  const defaultColumns = [
    { id: 'col1', accessorKey: 'col1', getCanHide: () => true },
    { id: 'col2', accessorKey: 'col2', getCanHide: () => true },
    { id: 'col3', accessorKey: 'col3', getCanHide: () => true },
  ];

  const mockColumns = (columns || defaultColumns).map(col => ({
    ...col,
    getIsVisible: () => columnVisibility[col.id] !== false,
  }));

  return {
    atoms: {
      columnVisibility: { get: vi.fn(() => columnVisibility) },
      columnFilters: { get: vi.fn(() => []) },
      globalFilter: { get: vi.fn(() => undefined) },
      sorting: { get: vi.fn(() => []) },
      pagination: { get: vi.fn(() => ({ pageIndex: 0, pageSize: 10 })) },
      rowSelection: { get: vi.fn(() => ({})) },
    },
    setColumnVisibility,
    getAllColumns: () => mockColumns,
    options: {},
    // Add other required Table methods as needed
    getCoreRowModel: vi.fn(),
    getRowModel: vi.fn(),
    getFilteredRowModel: vi.fn(),
    getPaginatedRowModel: vi.fn(),
    getSortedRowModel: vi.fn(),
    getFacetedRowModel: vi.fn(),
    getFacetedUniqueValues: vi.fn(),
    getFacetedMinMaxValues: vi.fn(),
    getColumn: vi.fn(),
    getHeaderGroups: vi.fn(),
    getFooterGroups: vi.fn(),
    getFlatHeaders: vi.fn(),
    getLeafHeaders: vi.fn(),
    getSelectedRowModel: vi.fn(),
    getCanNextPage: vi.fn(),
    getCanPreviousPage: vi.fn(),
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    setPageIndex: vi.fn(),
    resetPageIndex: vi.fn(),
    setPageSize: vi.fn(),
    resetPageSize: vi.fn(),
    setPageCount: vi.fn(),
    getPageCount: vi.fn(),
    getRowCount: vi.fn(),
    getPreFilteredRowModel: vi.fn(),
    getPreSortedRowModel: vi.fn(),
    getPrePaginatedRowModel: vi.fn(),
    resetColumnFilters: vi.fn(),
    resetGlobalFilter: vi.fn(),
    getGlobalFilterFn: vi.fn(),
    setGlobalFilter: vi.fn(),
    resetSorting: vi.fn(),
    resetRowSelection: vi.fn(),
    resetColumnSizing: vi.fn(),
    getTotalSize: vi.fn(),
    getIsAllRowsSelected: vi.fn(),
    getIsAllPageRowsSelected: vi.fn(),
    getIsSomeRowsSelected: vi.fn(),
    getIsSomePageRowsSelected: vi.fn(),
    getToggleAllRowsSelectedHandler: vi.fn(),
    getToggleAllPageRowsSelectedHandler: vi.fn(),
    resetPagination: vi.fn(),
    setSorting: vi.fn(),
    setColumnFilters: vi.fn(),
    setColumnSizing: vi.fn(),
    setRowSelection: vi.fn(),
    resetColumnVisibility: vi.fn(),
    getAllLeafColumns: vi.fn(),
    getAllFlatColumns: vi.fn(),
  } as unknown as DataTableInstance<TData>;
}
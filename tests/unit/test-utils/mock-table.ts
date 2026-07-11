import type { Table, VisibilityState } from '@tanstack/react-table';

interface MockTableOptions {
  columnVisibility: VisibilityState;
  setColumnVisibility: vi.Mock;
  columns?: Array<{
    id: string;
    accessorKey?: string;
    accessorFn?: () => unknown;
    getCanHide: () => boolean;
  }>;
}

export function createMockTable<TData = unknown>({
  columnVisibility,
  setColumnVisibility,
  columns,
}: MockTableOptions): Table<TData> {
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
    getState: () => ({
      columnVisibility,
      columnFilters: [],
      sorting: [],
      pagination: { pageIndex: 0, pageSize: 10 },
    }),
    setColumnVisibility,
    getAllColumns: () => mockColumns,
    options: {
      onStateChange: vi.fn(),
    },
    // Add other required Table methods as needed
    getCoreRowModel: vi.fn(),
    getRowModel: vi.fn(),
    getPrePaginationRowModel: vi.fn(),
    getFilteredRowModel: vi.fn(),
    getPaginationRowModel: vi.fn(),
    getSortedRowModel: vi.fn(),
    getFacetedRowModel: vi.fn(),
    getFacetedUniqueValues: vi.fn(),
    getFacetedMinMaxValues: vi.fn(),
    getColumn: vi.fn(),
    getHeaderGroups: vi.fn(),
    getFooterGroups: vi.fn(),
    getFlatHeaders: vi.fn(),
    getLeafHeaders: vi.fn(),
    getLeftFlatHeaders: vi.fn(),
    getCenterFlatHeaders: vi.fn(),
    getRightFlatHeaders: vi.fn(),
    getLeftHeaderGroups: vi.fn(),
    getCenterHeaderGroups: vi.fn(),
    getRightHeaderGroups: vi.fn(),
    getLeftFooterGroups: vi.fn(),
    getCenterFooterGroups: vi.fn(),
    getRightFooterGroups: vi.fn(),
    getSelectedRowModel: vi.fn(),
    getGroupedRowModel: vi.fn(),
    getExpandedRowModel: vi.fn(),
    getCanSomeRowsExpand: vi.fn(),
    getToggleAllRowsExpandedHandler: vi.fn(),
    getIsSomeRowsExpanded: vi.fn(),
    getIsAllRowsExpanded: vi.fn(),
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
    getPreGroupedRowModel: vi.fn(),
    getPreSortedRowModel: vi.fn(),
    getPreExpandedRowModel: vi.fn(),
    getPrePaginatedRowModel: vi.fn(),
    resetColumnFilters: vi.fn(),
    resetGlobalFilter: vi.fn(),
    getGlobalFilterFn: vi.fn(),
    setGlobalFilter: vi.fn(),
    resetSorting: vi.fn(),
    resetRowSelection: vi.fn(),
    resetColumnOrder: vi.fn(),
    resetColumnPinning: vi.fn(),
    resetColumnSizing: vi.fn(),
    resetColumnSizingInfo: vi.fn(),
    resetHeaderSizeInfo: vi.fn(),
    getTotalSize: vi.fn(),
    getLeftTotalSize: vi.fn(),
    getCenterTotalSize: vi.fn(),
    getRightTotalSize: vi.fn(),
    resetExpanded: vi.fn(),
    getIsAllRowsSelected: vi.fn(),
    getIsAllPageRowsSelected: vi.fn(),
    getIsSomeRowsSelected: vi.fn(),
    getIsSomePageRowsSelected: vi.fn(),
    getToggleAllRowsSelectedHandler: vi.fn(),
    getToggleAllPageRowsSelectedHandler: vi.fn(),
    resetPagination: vi.fn(),
    setSorting: vi.fn(),
    setColumnFilters: vi.fn(),
    setColumnOrder: vi.fn(),
    setColumnPinning: vi.fn(),
    setColumnSizing: vi.fn(),
    setColumnSizingInfo: vi.fn(),
    setRowSelection: vi.fn(),
    setExpanded: vi.fn(),
    setGrouping: vi.fn(),
    resetGrouping: vi.fn(),
    resetColumnVisibility: vi.fn(),
    getAllLeafColumns: vi.fn(),
    getAllFlatColumns: vi.fn(),
    getCenterLeafColumns: vi.fn(),
    getLeftLeafColumns: vi.fn(),
    getRightLeafColumns: vi.fn(),
  } as unknown as Table<TData>;
}
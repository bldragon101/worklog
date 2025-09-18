import type { Table, VisibilityState } from '@tanstack/react-table';

interface MockTableOptions {
  columnVisibility: VisibilityState;
  setColumnVisibility: jest.Mock;
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
      onStateChange: jest.fn(),
    },
    // Add other required Table methods as needed
    getCoreRowModel: jest.fn(),
    getRowModel: jest.fn(),
    getPrePaginationRowModel: jest.fn(),
    getFilteredRowModel: jest.fn(),
    getPaginationRowModel: jest.fn(),
    getSortedRowModel: jest.fn(),
    getFacetedRowModel: jest.fn(),
    getFacetedUniqueValues: jest.fn(),
    getFacetedMinMaxValues: jest.fn(),
    getColumn: jest.fn(),
    getHeaderGroups: jest.fn(),
    getFooterGroups: jest.fn(),
    getFlatHeaders: jest.fn(),
    getLeafHeaders: jest.fn(),
    getLeftFlatHeaders: jest.fn(),
    getCenterFlatHeaders: jest.fn(),
    getRightFlatHeaders: jest.fn(),
    getLeftHeaderGroups: jest.fn(),
    getCenterHeaderGroups: jest.fn(),
    getRightHeaderGroups: jest.fn(),
    getLeftFooterGroups: jest.fn(),
    getCenterFooterGroups: jest.fn(),
    getRightFooterGroups: jest.fn(),
    getSelectedRowModel: jest.fn(),
    getGroupedRowModel: jest.fn(),
    getExpandedRowModel: jest.fn(),
    getCanSomeRowsExpand: jest.fn(),
    getToggleAllRowsExpandedHandler: jest.fn(),
    getIsSomeRowsExpanded: jest.fn(),
    getIsAllRowsExpanded: jest.fn(),
    getCanNextPage: jest.fn(),
    getCanPreviousPage: jest.fn(),
    nextPage: jest.fn(),
    previousPage: jest.fn(),
    setPageIndex: jest.fn(),
    resetPageIndex: jest.fn(),
    setPageSize: jest.fn(),
    resetPageSize: jest.fn(),
    setPageCount: jest.fn(),
    getPageCount: jest.fn(),
    getRowCount: jest.fn(),
    getPreFilteredRowModel: jest.fn(),
    getPreGroupedRowModel: jest.fn(),
    getPreSortedRowModel: jest.fn(),
    getPreExpandedRowModel: jest.fn(),
    getPrePaginatedRowModel: jest.fn(),
    resetColumnFilters: jest.fn(),
    resetGlobalFilter: jest.fn(),
    getGlobalFilterFn: jest.fn(),
    setGlobalFilter: jest.fn(),
    resetSorting: jest.fn(),
    resetRowSelection: jest.fn(),
    resetColumnOrder: jest.fn(),
    resetColumnPinning: jest.fn(),
    resetColumnSizing: jest.fn(),
    resetColumnSizingInfo: jest.fn(),
    resetHeaderSizeInfo: jest.fn(),
    getTotalSize: jest.fn(),
    getLeftTotalSize: jest.fn(),
    getCenterTotalSize: jest.fn(),
    getRightTotalSize: jest.fn(),
    resetExpanded: jest.fn(),
    getIsAllRowsSelected: jest.fn(),
    getIsAllPageRowsSelected: jest.fn(),
    getIsSomeRowsSelected: jest.fn(),
    getIsSomePageRowsSelected: jest.fn(),
    getToggleAllRowsSelectedHandler: jest.fn(),
    getToggleAllPageRowsSelectedHandler: jest.fn(),
    resetPagination: jest.fn(),
    setSorting: jest.fn(),
    setColumnFilters: jest.fn(),
    setColumnOrder: jest.fn(),
    setColumnPinning: jest.fn(),
    setColumnSizing: jest.fn(),
    setColumnSizingInfo: jest.fn(),
    setRowSelection: jest.fn(),
    setExpanded: jest.fn(),
    setGrouping: jest.fn(),
    resetGrouping: jest.fn(),
    resetColumnVisibility: jest.fn(),
    getAllLeafColumns: jest.fn(),
    getAllFlatColumns: jest.fn(),
    getCenterLeafColumns: jest.fn(),
    getLeftLeafColumns: jest.fn(),
    getRightLeafColumns: jest.fn(),
  } as unknown as Table<TData>;
}
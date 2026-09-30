import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";
import type {
  Cell,
  Column,
  ColumnDef,
  Header,
  Row,
  RowData,
  Table,
} from "@tanstack/react-table";
import type { DataTableColumnMeta } from "@/components/data-table/core/types";

/**
 * Feature set shared by every data table in the app. Registers the stock
 * features, row models and built-in filter/sort functions the tables rely on.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnFacetingFeature,
  columnSizingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns,
  sortFns,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableInstance<TData extends RowData> = Table<
  DataTableFeatures,
  TData
>;

export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;

export type DataTableColumn<
  TData extends RowData,
  TValue = unknown,
> = Column<DataTableFeatures, TData, TValue>;

export type DataTableColumnDef<
  TData extends RowData,
  TValue = unknown,
> = ColumnDef<DataTableFeatures, TData, TValue>;

export type DataTableCell<TData extends RowData, TValue = unknown> = Cell<
  DataTableFeatures,
  TData,
  TValue
>;

export type DataTableHeader<TData extends RowData, TValue = unknown> = Header<
  DataTableFeatures,
  TData,
  TValue
>;

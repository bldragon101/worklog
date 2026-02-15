"use client";

import { Table } from "@tanstack/react-table";
import { DriverDataTableToolbar } from "./driver-data-table-toolbar";
import type { Driver } from "@/lib/types";

interface DriverDataTableToolbarWrapperProps {
  table: Table<Driver>;
  onImportSuccess?: () => void;
  onAdd?: () => void;
  onMultiDelete?: (data: Driver[]) => Promise<void>;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  activeCount?: number;
  archivedCount?: number;
}

export function DriverDataTableToolbarWrapper({
  table,
  onAdd,
  onImportSuccess,
  onMultiDelete,
  activeTab,
  onTabChange,
  activeCount,
  archivedCount,
}: DriverDataTableToolbarWrapperProps) {
  // Extract current filter values from table state
  const globalFilter = table.getState().globalFilter || "";
  const typeFilter = table.getColumn("type")?.getFilterValue() as
    | string
    | undefined;

  const filters = {
    driver: globalFilter,
    type: typeFilter,
  };

  return (
    <DriverDataTableToolbar
      table={table}
      onAddDriver={onAdd}
      onImportSuccess={onImportSuccess}
      onMultiDelete={onMultiDelete}
      filters={filters}
      activeTab={activeTab}
      onTabChange={onTabChange}
      activeCount={activeCount}
      archivedCount={archivedCount}
    />
  );
}

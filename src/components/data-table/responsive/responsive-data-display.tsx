"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table/core/data-table";
import { MobileCardView } from "@/components/data-table/mobile/mobile-card-view";
import type { ColumnDef, Table } from "@tanstack/react-table";
import type { SheetField } from "@/components/data-table/core/types";

interface MobileCardField {
  key: string;
  label: string;
  render?: (value: unknown, item: unknown) => React.ReactNode;
  className?: string;
  isBadge?: boolean;
  isTitle?: boolean;
  isSubtitle?: boolean;
}

interface ResponsiveDataDisplayProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  mobileFields: MobileCardField[];
  sheetFields?: SheetField<TData, unknown>[];
  onEdit?: (data: TData) => void;
  onDelete?: (data: TData) => void;
  onCardClick?: (data: TData) => void;
  isLoading?: boolean;
  loadingRowId?: number | null;
  onTableReady?: (table: Table<TData>) => void;
  getItemId?: (item: TData) => number | string;
}

export function ResponsiveDataDisplay<TData>({
  data,
  columns,
  mobileFields,
  sheetFields = [],
  onEdit,
  onDelete,
  onCardClick,
  isLoading = false,
  loadingRowId,
  onTableReady,
  getItemId,
}: ResponsiveDataDisplayProps<TData>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  return (
    <>
      {/* Desktop Table View */}
      <div className={`${isMobile ? 'hidden' : 'block'}`}>
        <DataTable
          data={data}
          columns={columns}
          sheetFields={sheetFields}
          onEdit={onEdit}
          onDelete={onDelete}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          onTableReady={onTableReady}
        />
      </div>

      {/* Mobile Card View */}
      <div className={`${isMobile ? 'block' : 'hidden'}`}>
        <MobileCardView
          data={data}
          fields={mobileFields}
          onEdit={onEdit}
          onDelete={onDelete}
          onCardClick={onCardClick}
          isLoading={isLoading}
          loadingRowId={loadingRowId}
          getItemId={getItemId}
        />
      </div>
    </>
  );
}
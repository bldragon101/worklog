"use client";

import * as React from "react";
import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTableFilterField } from "../core/types";
import { cn } from "@/lib/utils/utils";

interface DataTableSheetRowActionProps<
  TData,
> extends React.HTMLAttributes<HTMLButtonElement> {
  table: Table<TData>;
  fieldValue: keyof TData;
  value: string;
  filterFields: DataTableFilterField<TData>[];
}

export function DataTableSheetRowAction<TData>({
  table,
  fieldValue,
  value,
  filterFields: _filterFields,
  className,
  children,
  ...props
}: DataTableSheetRowActionProps<TData>) {
  const handleClick = () => {
    try {
      // Only attempt to filter if the column exists in the table
      const column = table.getColumn(fieldValue.toString());
      if (!column) {
        console.warn(
          `Column '${fieldValue.toString()}' does not exist in table, skipping filter`,
        );
        return;
      }

      // Add filter for this field value
      const existingFilter = column.getFilterValue();
      if (existingFilter !== value) {
        column.setFilterValue(value);
      }
    } catch (error) {
      console.warn(
        `Column '${fieldValue.toString()}' does not exist in table, skipping filter:`,
        error,
      );
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        "h-auto p-0 hover:bg-muted/80 dark:hover:bg-muted/50 justify-start text-left font-normal",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

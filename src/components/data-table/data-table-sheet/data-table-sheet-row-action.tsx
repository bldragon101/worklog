"use client";

import * as React from "react";
import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTableFilterField } from "../types";
import { cn } from "@/lib/utils";

interface DataTableSheetRowActionProps<TData>
  extends React.HTMLAttributes<HTMLButtonElement> {
  table: Table<TData>;
  fieldValue: keyof TData;
  value: string;
  filterFields: DataTableFilterField<TData>[];
}

export function DataTableSheetRowAction<TData>({
  table,
  fieldValue,
  value,
  filterFields,
  className,
  children,
  ...props
}: DataTableSheetRowActionProps<TData>) {
  const handleClick = () => {
    // Add filter for this field value
    const existingFilter = table.getColumn(fieldValue.toString())?.getFilterValue();
    if (existingFilter !== value) {
      table.getColumn(fieldValue.toString())?.setFilterValue(value);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        "h-auto p-0 hover:bg-muted/50 justify-start text-left font-normal",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
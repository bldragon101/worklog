"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Table } from "@tanstack/react-table";
import { DataTableSheetRowAction } from "./data-table-sheet-row-action";
import { DataTableFilterField, SheetField } from "../core/types";
import { SheetDetailsContentSkeleton } from "./data-table-sheet-skeleton";

interface DataTableSheetContentProps<TData, TMeta>
  extends React.HTMLAttributes<HTMLDListElement> {
  data?: TData;
  table: Table<TData>;
  fields: SheetField<TData, TMeta>[];
  filterFields: DataTableFilterField<TData>[];
  metadata?: TMeta & {
    totalRows: number;
    filterRows: number;
    totalRowsFetched: number;
  };
}

export function DataTableSheetContent<TData, TMeta>({
  data,
  table,
  className,
  fields,
  filterFields,
  metadata,
  ...props
}: DataTableSheetContentProps<TData, TMeta>) {
  if (!data) return <SheetDetailsContentSkeleton fields={fields} />;

  return (
    <dl className={cn("divide-y", className)} {...props}>
      {fields.map((field) => {
        if (field.condition && !field.condition(data)) return null;

        const Component = field.component;
        const value = String(data[field.id]);

        return (
          <div key={field.id.toString()}>
            {field.type === "clickable" ? (
              <DataTableSheetRowAction
                fieldValue={field.id}
                filterFields={filterFields}
                value={value}
                table={table}
                className={cn(
                  "flex gap-4 my-1 py-1.5 text-sm w-full",
                  field.className
                )}
              >
                <dt className="shrink-0 text-muted-foreground min-w-0 w-1/3">
                  {field.label}
                </dt>
                <dd className="font-mono min-w-0 flex-1 text-right break-words overflow-wrap-anywhere">
                  {Component ? (
                    <Component {...data} metadata={metadata} />
                  ) : (
                    <span className="break-words">{value}</span>
                  )}
                </dd>
              </DataTableSheetRowAction>
            ) : (
              <div
                className={cn(
                  "flex gap-4 my-1 py-1.5 text-sm w-full",
                  field.className
                )}
              >
                <dt className="shrink-0 text-muted-foreground min-w-0 w-1/3">
                  {field.label}
                </dt>
                <dd className="font-mono min-w-0 flex-1 text-right break-words overflow-wrap-anywhere">
                  {Component ? (
                    <Component {...data} metadata={metadata} />
                  ) : (
                    <span className="break-words">{value}</span>
                  )}
                </dd>
              </div>
            )}
          </div>
        );
      })}
    </dl>
  );
}

export const MemoizedDataTableSheetContent = React.memo(
  DataTableSheetContent,
  (prev, next) => {
    return prev.data === next.data;
  }
) as typeof DataTableSheetContent;
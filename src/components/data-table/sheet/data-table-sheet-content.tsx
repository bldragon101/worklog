"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Table } from "@tanstack/react-table";
import { DataTableSheetRowAction } from "./data-table-sheet-row-action";
import { DataTableFilterField, SheetField } from "../core/types";
import { SheetDetailsContentSkeleton } from "@/components/ui/skeleton";

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
            {field.id === "attachmentRunsheet" ? (
              // Special full-width layout for attachments
              <div className="w-full my-1 py-1.5">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {field.label}
                </div>
                <div className="w-full">
                  {Component ? (
                    <Component {...data} metadata={metadata} />
                  ) : (
                    <span className="break-words">{value}</span>
                  )}
                </div>
              </div>
            ) : field.type === "clickable" ? (
              <DataTableSheetRowAction
                fieldValue={field.id}
                filterFields={filterFields}
                value={value}
                table={table}
                className={cn(
                  "flex gap-4 my-1 py-1.5 text-sm w-full",
                  field.className,
                )}
              >
                <dt className="shrink-0 text-muted-foreground min-w-0 w-1/3">
                  {field.label}
                </dt>
                <dd
                  className={cn(
                    "font-mono min-w-0 flex-1 break-words overflow-wrap-anywhere",
                    field.className?.includes("!text-left")
                      ? "text-left"
                      : "text-right",
                  )}
                >
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
                  field.className,
                )}
              >
                <dt className="shrink-0 text-muted-foreground min-w-0 w-1/3">
                  {field.label}
                </dt>
                <dd
                  className={cn(
                    "font-mono min-w-0 flex-1 break-words overflow-wrap-anywhere",
                    field.className?.includes("!text-left")
                      ? "text-left"
                      : "text-right",
                  )}
                >
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
  },
) as typeof DataTableSheetContent;

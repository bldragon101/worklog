"use client";

import * as React from "react";
import { MemoizedDataTableSheetContent } from "./data-table-sheet-content";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { DataTableFilterField, SheetField } from "../types";

interface DataTableSheetDetailsProps<TData, TMeta> {
  data: TData;
  table: Table<TData>;
  fields: SheetField<TData, TMeta>[];
  filterFields: DataTableFilterField<TData>[];
  metadata?: TMeta & {
    totalRows: number;
    filterRows: number;
    totalRowsFetched: number;
  };
  onEdit?: (data: TData) => void;
}

export function DataTableSheetDetails<TData, TMeta>({
  data,
  table,
  fields,
  filterFields,
  metadata,
  onEdit,
}: DataTableSheetDetailsProps<TData, TMeta>) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Details</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <MemoizedDataTableSheetContent
            data={data}
            table={table}
            fields={fields}
            filterFields={filterFields}
            metadata={metadata}
          />
          {onEdit && (
            <div className="pt-4 border-t">
              <Button 
                onClick={() => {
                  onEdit(data);
                  setIsOpen(false);
                }}
                className="w-full"
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SheetField } from "../core/types";

interface SheetDetailsContentSkeletonProps<TData, TMeta> {
  fields: SheetField<TData, TMeta>[];
}

export function SheetDetailsContentSkeleton<TData, TMeta>({
  fields,
}: SheetDetailsContentSkeletonProps<TData, TMeta>) {
  return (
    <dl className="divide-y">
      {fields.map((field) => (
        <div
          key={field.id.toString()}
          className="flex gap-4 my-1 py-1 text-sm justify-between items-center w-full"
        >
          <dt className="shrink-0 text-muted-foreground">
            {field.label}
          </dt>
          <dd className="font-mono w-full text-right">
            <Skeleton className="h-4 w-20 ml-auto" />
          </dd>
        </div>
      ))}
    </dl>
  );
}
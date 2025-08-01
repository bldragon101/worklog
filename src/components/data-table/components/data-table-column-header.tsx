import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> extends ButtonProps {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        column.toggleSorting(undefined);
      }}
      className={cn(
        "py-0 px-0 h-7 hover:bg-muted/50 hover:text-foreground flex gap-2 items-center justify-between w-full transition-colors duration-200 cursor-pointer group",
        className
      )}
      {...props}
    >
      <span className="group-hover:text-foreground transition-colors">{title}</span>
      <span className="flex flex-col">
        <ChevronUp
          className={cn(
            "-mb-0.5 h-3 w-3 transition-colors",
            column.getIsSorted() === "asc"
              ? "text-accent-foreground"
              : "text-muted-foreground group-hover:text-foreground/70"
          )}
        />
        <ChevronDown
          className={cn(
            "-mt-0.5 h-3 w-3 transition-colors",
            column.getIsSorted() === "desc"
              ? "text-accent-foreground"
              : "text-muted-foreground group-hover:text-foreground/70"
          )}
        />
      </span>
    </Button>
  );
}
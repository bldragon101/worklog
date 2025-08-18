import type { ColumnMeta as BaseColumnMeta } from "@tanstack/react-table";

export interface DataTableFilterField<TData> {
  label: string;
  value: keyof TData;
  placeholder?: string;
  options?: Array<{
    label: string;
    value: string;
    count?: number;
  }>;
  isMulti?: boolean;
}

export interface SheetField<TData, TMeta = unknown> {
  id: keyof TData;
  label: string;
  type?: "readonly" | "action" | "clickable";
  component?: React.ComponentType<TData & { metadata?: TMeta }>;
  condition?: (data: TData) => boolean;
  className?: string;
}

// Extend the base ColumnMeta type to include our custom properties
export interface ColumnMeta<TData, TValue> extends BaseColumnMeta<TData, TValue> {
  hidden?: boolean;
}
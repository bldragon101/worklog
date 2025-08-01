
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
  type?: "readonly" | "action";
  component?: React.ComponentType<TData & { metadata?: TMeta }>;
  condition?: (data: TData) => boolean;
  className?: string;
}
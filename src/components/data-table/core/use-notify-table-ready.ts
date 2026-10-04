"use client";

import * as React from "react";
import type { RowData } from "@tanstack/react-table";
import type { DataTableInstance } from "@/components/data-table/core/table-features";

/**
 * Pass the table to `onTableReady` when the underlying instance, its state or
 * its data changes, and when a callback is first attached.
 *
 * `useTable` returns a new object on every render, so this deliberately does
 * not depend on the table itself: the parent stores the table in state, and
 * depending on it would re-render the parent, then this component, forever.
 * The latest table and callback are read through an effect event, so a new
 * callback identity does not notify either.
 */
export function useNotifyTableReady<TData extends RowData>({
  table,
  state,
  data,
  onTableReady,
}: {
  table: DataTableInstance<TData>;
  /** The selected table state, which keeps its identity until state changes */
  state: unknown;
  data: TData[];
  onTableReady?: (table: DataTableInstance<TData>) => void;
}) {
  const notifyTableReady = React.useEffectEvent(() => {
    onTableReady?.(table);
  });
  const hasTableReadyCallback = Boolean(onTableReady);

  React.useEffect(() => {
    notifyTableReady();
  }, [table.store, state, data, hasTableReadyCallback]);
}

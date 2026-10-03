"use client";

import { useEffect } from "react";
import type { DataTableInstance } from "@/components/data-table/core/table-features";
import { DataTableFacetedFilterSimple } from "@/components/data-table/components/data-table-faceted-filter-simple";
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/contexts/search-context";
import { formatCurrency } from "@/lib/utils/currency";
import type { TollJobRow, TollTripRow } from "@/lib/tolls/toll-types";
import {
  TOLL_MATCH_LABELS,
  TOLL_ROAD_LABELS,
  getTripRegistration,
} from "@/components/tolls/toll-columns";
import { TollRefreshButton } from "@/components/tolls/toll-refresh-button";
import { TollUploadButton } from "@/components/tolls/toll-upload-button";

function ToolbarSummary({ items }: { items: string[] }) {
  return (
    <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
      {items.join(" · ")}
    </div>
  );
}

function ResetFiltersButton({
  id,
  onReset,
}: {
  id: string;
  onReset: () => void;
}) {
  return (
    <Button
      id={id}
      type="button"
      variant="ghost"
      onClick={onReset}
      className="h-8 px-2 lg:px-3 flex-shrink-0 rounded"
      size="sm"
    >
      Reset
    </Button>
  );
}

function sumAmounts({ amounts }: { amounts: number[] }): number {
  return amounts.reduce((total, amount) => total + Math.round(amount * 100), 0) / 100;
}

export function TollTripsToolbar({
  table,
  onImportSuccess,
}: {
  table: DataTableInstance<TollTripRow>;
  onImportSuccess?: () => void;
}) {
  const { globalSearchValue } = useSearch();

  useEffect(() => {
    table.setGlobalFilter(globalSearchValue);
  }, [globalSearchValue, table]);

  const isFiltered = table.atoms.columnFilters.get().length > 0;
  const allTrips = table.getCoreRowModel().rows.map((row) => row.original);
  const filteredTrips = table.getFilteredRowModel().rows.map((row) => row.original);
  const unmatchedTrips = filteredTrips.filter((trip) => trip.matchStatus !== "matched");

  const registrationOptions = [
    ...new Set(allTrips.map((trip) => getTripRegistration({ trip }))),
  ]
    .sort()
    .map((registration) => ({ label: registration, value: registration }));
  const roadOptions = Object.entries(TOLL_ROAD_LABELS).map(([value, label]) => ({
    label,
    value,
  }));
  const matchOptions = Object.entries(TOLL_MATCH_LABELS).map(([value, label]) => ({
    label,
    value,
  }));

  return (
    <div className="bg-white dark:bg-background px-4 pb-3 pt-3 border-b">
      <div className="flex flex-wrap items-center gap-2 justify-between min-h-[2rem]">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <DataTableFacetedFilterSimple
            column={table.getColumn("registration")}
            title="Registration"
            options={registrationOptions}
          />
          <DataTableFacetedFilterSimple
            column={table.getColumn("road")}
            title="Road"
            options={roadOptions}
          />
          <DataTableFacetedFilterSimple
            column={table.getColumn("matchStatus")}
            title="Job match"
            options={matchOptions}
          />
          {isFiltered && (
            <ResetFiltersButton
              id="reset-toll-trip-filters-btn"
              onReset={() => table.resetColumnFilters()}
            />
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ToolbarSummary
            items={[
              `${filteredTrips.length} trips`,
              formatCurrency({
                amount: sumAmounts({ amounts: filteredTrips.map((trip) => trip.amount) }),
              }),
              `${unmatchedTrips.length} unmatched (${formatCurrency({
                amount: sumAmounts({ amounts: unmatchedTrips.map((trip) => trip.amount) }),
              })})`,
            ]}
          />
          <DataTableViewOptions table={table} />
          <TollRefreshButton />
          <TollUploadButton onImportSuccess={onImportSuccess} />
        </div>
      </div>
    </div>
  );
}

export function TollJobsToolbar({ table }: { table: DataTableInstance<TollJobRow> }) {
  const { globalSearchValue } = useSearch();

  useEffect(() => {
    table.setGlobalFilter(globalSearchValue);
  }, [globalSearchValue, table]);

  const isFiltered = table.atoms.columnFilters.get().length > 0;
  const filteredJobs = table.getFilteredRowModel().rows.map((row) => row.original);
  const mismatchCount = filteredJobs.filter((job) => job.isMismatch).length;

  return (
    <div className="bg-white dark:bg-background px-4 pb-3 pt-3 border-b">
      <div className="flex flex-wrap items-center gap-2 justify-between min-h-[2rem]">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <DataTableFacetedFilterSimple
            column={table.getColumn("status")}
            title="Status"
            options={[
              { label: "Mismatch", value: "mismatch" },
              { label: "OK", value: "ok" },
            ]}
          />
          {isFiltered && (
            <ResetFiltersButton
              id="reset-toll-job-filters-btn"
              onReset={() => table.resetColumnFilters()}
            />
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ToolbarSummary
            items={[
              `${filteredJobs.length} jobs`,
              `${mismatchCount} mismatched`,
              formatCurrency({
                amount: sumAmounts({ amounts: filteredJobs.map((job) => job.tollCost) }),
              }),
            ]}
          />
          <DataTableViewOptions table={table} />
        </div>
      </div>
    </div>
  );
}

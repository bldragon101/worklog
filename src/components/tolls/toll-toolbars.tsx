"use client";

import { useEffect } from "react";
import type { RowData } from "@tanstack/react-table";
import type { DataTableInstance } from "@/components/data-table/core/table-features";
import { DataTableFacetedFilterSimple } from "@/components/data-table/components/data-table-faceted-filter-simple";
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options";
import { Button } from "@/components/ui/button";
import { useSearch } from "@/contexts/search-context";
import { formatCurrency } from "@/lib/utils/currency";
import type { TollJobRow, TollTripRow } from "@/lib/tolls/toll-types";
import { TOLL_ROAD_LABELS } from "@/lib/tolls/toll-matching";
import {
  TOLL_MATCH_LABELS,
  getTripRegistration,
} from "@/components/tolls/toll-columns";
import {
  formatTollGroupsForCopy,
  groupTollJobsForCopy,
  groupTollTripsForCopy,
  sumTollTripAmounts,
} from "@/lib/tolls/toll-copy";
import { CopyTollsButton } from "@/components/tolls/copy-tolls-button";
import { TollDriveImportButton } from "@/components/tolls/toll-drive-import-button";
import { TollUploadButton } from "@/components/tolls/toll-upload-button";

function ToolbarSummary({ items }: { items: string[] }) {
  return (
    <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
      {items.join(" · ")}
    </div>
  );
}

function ClearSelectionButton({
  id,
  onClear,
}: {
  id: string;
  onClear: () => void;
}) {
  return (
    <Button
      id={id}
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClear}
      className="h-8 px-2 flex-shrink-0 rounded"
    >
      Clear selection
    </Button>
  );
}

/**
 * The ticked rows the filters still show, and how many ticked rows they hide.
 * Hidden rows still count as a selection, so Copy never falls back to copying
 * every listed row while some are ticked.
 */
function getRowSelection<TData extends RowData>({
  table,
}: {
  table: DataTableInstance<TData>;
}): { hasSelection: boolean; visible: TData[]; hiddenCount: number } {
  const selectedCount = table.getSelectedRowModel().rows.length;
  const visible = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  return {
    hasSelection: selectedCount > 0,
    visible,
    hiddenCount: selectedCount - visible.length,
  };
}

function describeSelection({
  visibleCount,
  hiddenCount,
  amount,
}: {
  visibleCount: number;
  hiddenCount: number;
  amount: number;
}): string {
  const selected = `${visibleCount} selected (${formatCurrency({ amount })})`;
  return hiddenCount > 0 ? `${selected}, ${hiddenCount} hidden by filters` : selected;
}

function describeCopyLabel({
  hasSelection,
  visibleCount,
}: {
  hasSelection: boolean;
  visibleCount: number;
}): string {
  return hasSelection ? `Copy ${visibleCount} selected` : "Copy all";
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
  const selection = getRowSelection({ table });
  const tripsToCopy = selection.hasSelection ? selection.visible : filteredTrips;

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
                amount: sumTollTripAmounts({ trips: filteredTrips }),
              }),
              `${unmatchedTrips.length} unmatched (${formatCurrency({
                amount: sumTollTripAmounts({ trips: unmatchedTrips }),
              })})`,
              ...(selection.hasSelection
                ? [
                    describeSelection({
                      visibleCount: selection.visible.length,
                      hiddenCount: selection.hiddenCount,
                      amount: sumTollTripAmounts({ trips: selection.visible }),
                    }),
                  ]
                : []),
            ]}
          />
          <DataTableViewOptions table={table} />
          {selection.hasSelection && (
            <ClearSelectionButton
              id="clear-toll-trip-selection-btn"
              onClear={() => table.resetRowSelection(true)}
            />
          )}
          <CopyTollsButton
            id="copy-toll-trips-btn"
            label={describeCopyLabel({
              hasSelection: selection.hasSelection,
              visibleCount: selection.visible.length,
            })}
            disabled={tripsToCopy.length === 0}
            description={`${tripsToCopy.length} toll trips copied for invoicing.`}
            getText={() =>
              formatTollGroupsForCopy({
                groups: groupTollTripsForCopy({ trips: tripsToCopy }),
              })
            }
          />
          <TollDriveImportButton onImportSuccess={onImportSuccess} />
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
  const selection = getRowSelection({ table });
  const jobsToCopy = (selection.hasSelection ? selection.visible : filteredJobs).filter(
    (job) => job.trips.length > 0,
  );

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
                amount: sumTollTripAmounts({
                  trips: filteredJobs.map((job) => ({ amount: job.tollCost })),
                }),
              }),
              ...(selection.hasSelection
                ? [
                    describeSelection({
                      visibleCount: selection.visible.length,
                      hiddenCount: selection.hiddenCount,
                      amount: sumTollTripAmounts({
                        trips: selection.visible.map((job) => ({ amount: job.tollCost })),
                      }),
                    }),
                  ]
                : []),
            ]}
          />
          <DataTableViewOptions table={table} />
          {selection.hasSelection && (
            <ClearSelectionButton
              id="clear-toll-job-selection-btn"
              onClear={() => table.resetRowSelection(true)}
            />
          )}
          <CopyTollsButton
            id="copy-toll-jobs-btn"
            label={describeCopyLabel({
              hasSelection: selection.hasSelection,
              visibleCount: selection.visible.length,
            })}
            disabled={jobsToCopy.length === 0}
            description={`Tolls for ${jobsToCopy.length} jobs copied for invoicing.`}
            getText={() =>
              formatTollGroupsForCopy({ groups: groupTollJobsForCopy({ jobs: jobsToCopy }) })
            }
          />
        </div>
      </div>
    </div>
  );
}

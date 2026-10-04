"use client";

import { useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/utils";

export interface JobFilterGroupOption {
  label: string;
  value: string;
  count?: number;
  displayLabel?: string;
}

export interface JobFilterGroup {
  columnId: string;
  title: string;
  options: JobFilterGroupOption[];
  selectedValues: string[];
}

interface JobMobileFiltersProps {
  groups: JobFilterGroup[];
  resultCount: number;
  onFilterChange: ({
    columnId,
    values,
  }: {
    columnId: string;
    values: string[];
  }) => void;
  onReset: () => void;
}

/**
 * Label shown for an option, with boolean filters read as Yes/No and dates as
 * a short weekday label taken straight from the ISO string.
 */
function optionLabel({
  columnId,
  option,
}: {
  columnId: string;
  option: JobFilterGroupOption;
}): string {
  if (columnId === "date") {
    return formatShortDate({ isoDate: option.value });
  }
  return option.displayLabel || option.label;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Format a yyyy-MM-dd string as "Mon 29 Sep" without timezone conversion.
 */
export function formatShortDate({ isoDate }: { isoDate: string }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAY_NAMES[weekday]} ${day} ${MONTH_NAMES[month - 1] ?? ""}`;
}

/**
 * Add the value to the selection, or remove it when it is already selected.
 */
function toggledValues({
  selectedValues,
  value,
}: {
  selectedValues: string[];
  value: string;
}): string[] {
  return selectedValues.includes(value)
    ? selectedValues.filter((selected) => selected !== value)
    : [...selectedValues, value];
}

/**
 * Mobile filter controls for the jobs list: a filter button that opens a
 * bottom sheet of tappable options.
 */
export function JobMobileFilters({
  groups,
  resultCount,
  onFilterChange,
  onReset,
}: JobMobileFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = groups.reduce(
    (total, group) => total + group.selectedValues.length,
    0,
  );

  const toggleValue = ({
    group,
    value,
  }: {
    group: JobFilterGroup;
    value: string;
  }) => {
    onFilterChange({
      columnId: group.columnId,
      values: toggledValues({ selectedValues: group.selectedValues, value }),
    });
  };

  return (
    <>
      <Button
        id="mobile-job-filters-btn"
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-2 rounded"
        onClick={() => setIsOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-xl p-0"
        >
          <SheetHeader className="border-b pb-3">
            <SheetTitle>Filter jobs</SheetTitle>
            <SheetDescription>
              {activeCount > 0
                ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied`
                : "Narrow down the jobs for this period"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {groups
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <section
                  key={group.columnId}
                  aria-labelledby={`mobile-job-filter-${group.columnId}-heading`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3
                      id={`mobile-job-filter-${group.columnId}-heading`}
                      className="text-sm font-semibold"
                    >
                      {group.title}
                    </h3>
                    {group.selectedValues.length > 0 && (
                      <button
                        id={`mobile-job-filter-${group.columnId}-clear-btn`}
                        type="button"
                        onClick={() =>
                          onFilterChange({ columnId: group.columnId, values: [] })
                        }
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const isSelected = group.selectedValues.includes(
                        option.value,
                      );
                      return (
                        <button
                          key={option.value}
                          id={`mobile-job-filter-${group.columnId}-${option.value}-btn`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            toggleValue({ group, value: option.value })
                          }
                          className={cn(
                            "flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-accent",
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {optionLabel({ columnId: group.columnId, option })}
                          </span>
                          {option.count !== undefined && (
                            <span
                              className={cn(
                                "font-mono text-xs",
                                isSelected
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground",
                              )}
                            >
                              {option.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>

          <SheetFooter className="flex-row gap-2 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              id="mobile-job-filters-reset-btn"
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onReset}
              disabled={activeCount === 0}
            >
              Clear all
            </Button>
            <Button
              id="mobile-job-filters-apply-btn"
              type="button"
              className="flex-[2]"
              onClick={() => setIsOpen(false)}
            >
              Show {resultCount} job{resultCount === 1 ? "" : "s"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Scrollable row of the active job filters, each tappable to remove it.
 */
export function JobActiveFilterChips({
  groups,
  onFilterChange,
  onReset,
}: Omit<JobMobileFiltersProps, "resultCount">) {
  const activeChips = groups.flatMap((group) =>
    group.selectedValues.map((value) => {
      const option = group.options.find(
        (candidate) => candidate.value === value,
      );
      return {
        group,
        value,
        label: option
          ? optionLabel({ columnId: group.columnId, option })
          : value,
      };
    }),
  );

  if (activeChips.length === 0) return null;

  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
      {activeChips.map((chip) => (
        <button
          key={`${chip.group.columnId}-${chip.value}`}
          id={`mobile-job-filter-chip-${chip.group.columnId}-${chip.value}-btn`}
          type="button"
          onClick={() =>
            onFilterChange({
              columnId: chip.group.columnId,
              values: toggledValues({
                selectedValues: chip.group.selectedValues,
                value: chip.value,
              }),
            })
          }
          aria-label={`Remove ${chip.group.title} filter ${chip.label}`}
          className="flex shrink-0 items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          <span className="text-muted-foreground">{chip.group.title}:</span>
          <span className="max-w-[10rem] truncate font-medium">
            {chip.label}
          </span>
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
      <button
        id="mobile-job-filters-clear-chips-btn"
        type="button"
        onClick={onReset}
        className="shrink-0 px-2 py-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

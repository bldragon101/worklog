"use client";

import type { DataTableInstance } from "@/components/data-table/core/table-features";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusCircle, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DataTableViewOptions } from "@/components/data-table/components/data-table-view-options";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
import type { Job } from "@/lib/types";
import { CsvImportExportDropdown } from "@/components/shared/csv-import-export-dropdown";
import { HoursInfoDialog } from "./hours-info-dialog";
import {
  JobActiveFilterChips,
  JobMobileFilters,
  type JobFilterGroup,
} from "./job-mobile-filters";
import { useSearch } from "@/contexts/search-context";
import { useIsMobile } from "@/hooks/use-mobile";

// Custom filter component that manages its own state
interface CustomFacetedFilterProps {
  columnId: string;
  title: string;
  options: {
    label: string;
    value: string;
    count?: number;
    displayLabel?: string;
  }[];
  selectedValues: string[];
  onFilterChange: (values: string[]) => void;
}

function CustomFacetedFilter({
  columnId,
  title,
  options,
  selectedValues,
  onFilterChange,
}: CustomFacetedFilterProps) {
  const handleCheckboxChange = (optionValue: string, checked: boolean) => {
    let newValues: string[];

    if (checked) {
      newValues = [...selectedValues, optionValue];
    } else {
      newValues = selectedValues.filter((val) => val !== optionValue);
    }

    onFilterChange(newValues);
  };

  const handleClearAll = () => {
    onFilterChange([]);
  };

  return (
    <div className="flex items-center space-x-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={`job-filter-${columnId}-btn`}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-dashed rounded"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {title}
            {selectedValues.length > 0 && (
              <>
                <Badge
                  variant="secondary"
                  className="rounded px-1 font-normal lg:hidden"
                >
                  {selectedValues.length}
                </Badge>
                <div className="flex space-x-1">
                  {columnId === "date" ? (
                    selectedValues.length > 3 ? (
                      <span className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal">
                        {selectedValues.length} selected
                      </span>
                    ) : (
                      selectedValues.map((value) => {
                        return (
                          <span
                            key={value}
                            className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal"
                          >
                            {value}
                          </span>
                        );
                      })
                    )
                  ) : // Original logic for other filters
                  selectedValues.length > 3 ? (
                    <span className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal">
                      {selectedValues.length} selected
                    </span>
                  ) : (
                    options
                      .filter((option) => selectedValues.includes(option.value))
                      .map((option) => (
                        <span
                          key={option.value}
                          className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal"
                        >
                          {option.displayLabel || option.label}
                        </span>
                      ))
                  )}
                </div>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <div className="max-h-[300px] overflow-y-auto p-3">
            <div className="grid gap-2">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);

                return (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`filter-${columnId}-${option.value}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        handleCheckboxChange(option.value, checked === true);
                      }}
                      className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label
                      htmlFor={`filter-${columnId}-${option.value}`}
                      className="flex flex-1 items-center justify-between text-sm font-normal cursor-pointer"
                    >
                      <span className="flex items-center">{option.label}</span>
                      {option.count !== undefined && (
                        <span className="ml-auto font-mono text-xs text-muted-foreground">
                          {option.count}
                        </span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
            {selectedValues.length > 0 && (
              <div className="pt-3 mt-3 border-t">
                <Button
                  id={`job-filter-${columnId}-clear-all-btn`}
                  type="button"
                  variant="ghost"
                  onClick={handleClearAll}
                  className="w-full h-8 text-sm"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedValues.length > 0 && (
        <Button
          id={`job-filter-${columnId}-clear-btn`}
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleClearAll}
          title={`Clear ${title} filter`}
          aria-label={`Clear ${title} filter`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

interface FilterOption {
  label: string;
  value: string;
  count?: number;
  displayLabel?: string;
}

interface JobFilterOptions {
  dateOptions: FilterOption[];
  driverOptions: FilterOption[];
  customerOptions: FilterOption[];
  billToOptions: FilterOption[];
  registrationOptions: FilterOption[];
  truckTypeOptions: FilterOption[];
  runsheetOptions: FilterOption[];
  invoicedOptions: FilterOption[];
}

/**
 * Build the faceted filter options (with counts) for the given jobs.
 */
function buildJobFilterOptions({
  jobs: data,
}: {
  jobs: Job[];
}): JobFilterOptions {
  if (data.length === 0) {
    // No filter options when there is no data
    return {
      dateOptions: [],
      driverOptions: [],
      customerOptions: [],
      billToOptions: [],
      registrationOptions: [],
      truckTypeOptions: [],
      runsheetOptions: [],
      invoicedOptions: [],
    };
  }

  // Helper function to count occurrences of each value
  const countValues = (values: string[]) => {
    const counts: Record<string, number> = {};
    for (const value of values) {
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  };

  // Get values and counts for each column
  const dates = data
    .map((job) => job.date)
    .filter((value) => value && value.trim())
    .map((dateStr) => dateStr.split("T")[0]);
  const drivers = data
    .map((job) => job.driver)
    .filter((value) => value && value.trim());
  const customers = data
    .map((job) => job.customer)
    .filter((value) => value && value.trim());
  const billTos = data
    .map((job) => job.billTo)
    .filter((value) => value && value.trim());
  const registrations = data
    .map((job) => job.registration)
    .filter((value) => value && value.trim());
  const truckTypes = data
    .map((job) => job.truckType)
    .filter((value) => value && value.trim());
  const runsheets = data.map((job) => (job.runsheet ? "true" : "false"));
  const invoiced = data.map((job) => (job.invoiced ? "true" : "false"));

  // Count occurrences
  const dateCounts = countValues(dates);
  const driverCounts = countValues(drivers);
  const customerCounts = countValues(customers);
  const billToCounts = countValues(billTos);
  const registrationCounts = countValues(registrations);
  const truckTypeCounts = countValues(truckTypes);
  const runsheetCounts = countValues(runsheets);
  const invoicedCounts = countValues(invoiced);

  // Get unique values and sort
  const uniqueDates = [...new Set(dates)].sort();
  const uniqueDrivers = [...new Set(drivers)].sort();
  const uniqueCustomers = [...new Set(customers)].sort();
  const uniqueBillTos = [...new Set(billTos)].sort();
  const uniqueRegistrations = [...new Set(registrations)].sort();
  const uniqueTruckTypes = [...new Set(truckTypes)].sort();

  const dateOptionsFormatted = uniqueDates.map((normalisedDate) => {
    return {
      label: normalisedDate,
      value: normalisedDate,
      count: dateCounts[normalisedDate],
      displayLabel: normalisedDate,
    };
  });

  return {
    dateOptions: dateOptionsFormatted,
    driverOptions: uniqueDrivers.map((value) => ({
      label: value,
      value,
      count: driverCounts[value],
    })),
    customerOptions: uniqueCustomers.map((value) => ({
      label: value,
      value,
      count: customerCounts[value],
    })),
    billToOptions: uniqueBillTos.map((value) => ({
      label: value,
      value,
      count: billToCounts[value],
    })),
    registrationOptions: uniqueRegistrations.map((value) => ({
      label: value,
      value,
      count: registrationCounts[value],
    })),
    truckTypeOptions: uniqueTruckTypes.map((value) => ({
      label: value,
      value,
      count: truckTypeCounts[value],
    })),
    // Runsheet and invoiced options with counts
    runsheetOptions: [
      { label: "Yes", value: "true", count: runsheetCounts["true"] || 0 },
      { label: "No", value: "false", count: runsheetCounts["false"] || 0 },
    ],
    invoicedOptions: [
      { label: "Yes", value: "true", count: invoicedCounts["true"] || 0 },
      { label: "No", value: "false", count: invoicedCounts["false"] || 0 },
    ],
  };
}

interface JobDataTableToolbarProps {
  table: DataTableInstance<Job>;
  onAdd?: () => void;
  onImportSuccess?: () => void;
  filters?: {
    startDate?: string;
    endDate?: string;
    driver?: string;
    customer?: string;
    billTo?: string;
    registration?: string;
    truckType?: string;
    isQuickEditMode?: boolean;
    canUseQuickEdit?: boolean;
    onToggleQuickEdit?: () => void;
  };
  isLoading?: boolean;
  dataLength?: number;
  showActions?: boolean;
}

export function JobDataTableToolbar({
  table,
  onAdd,
  onImportSuccess,
  filters,
  isLoading = false,
  showActions = true,
}: JobDataTableToolbarProps) {
  const { debouncedSearchValue } = useSearch();
  const isMobile = useIsMobile();
  // Custom filter state management (workaround for TanStack Table issue)
  const [customFilters, setCustomFilters] = useState<Record<string, string[]>>(
    {},
  );

  // Check if any custom filters are active
  const isFiltered = Object.values(customFilters).some(
    (values) => values.length > 0,
  );

  // Apply global search to table when debouncedSearchValue changes
  useEffect(() => {
    table.setGlobalFilter(debouncedSearchValue);
  }, [debouncedSearchValue, table]);

  const handleReset = () => {
    // Clear both table filters and custom filters
    table.resetColumnFilters();
    setCustomFilters({});
  };

  // Apply custom filters using column filters instead of global filter
  const applyCustomFilters = ({
    filters,
  }: {
    filters: Record<string, string[]>;
  }) => {
    setCustomFilters(filters);
    table.setColumnFilters(
      Object.entries(filters)
        .filter(([, values]) => values.length > 0)
        .map(([columnId, values]) => ({ id: columnId, value: values })),
    );
  };

  // Build filter options from the original unfiltered data so options do not
  // disappear as filters are applied
  const coreRows = table.getCoreRowModel().rows;
  const {
    dateOptions,
    driverOptions,
    customerOptions,
    billToOptions,
    registrationOptions,
    truckTypeOptions,
    runsheetOptions,
    invoicedOptions,
  } = useMemo(
    () => buildJobFilterOptions({ jobs: coreRows.map((row) => row.original) }),
    [coreRows],
  );

  const filterGroups: JobFilterGroup[] = [
    { columnId: "date", title: "Date", options: dateOptions },
    { columnId: "driver", title: "Driver", options: driverOptions },
    { columnId: "customer", title: "Customer", options: customerOptions },
    { columnId: "billTo", title: "Bill To", options: billToOptions },
    {
      columnId: "registration",
      title: "Registration",
      options: registrationOptions,
    },
    { columnId: "truckType", title: "Truck Type", options: truckTypeOptions },
    { columnId: "runsheet", title: "Runsheet", options: runsheetOptions },
    { columnId: "invoiced", title: "Invoiced", options: invoicedOptions },
  ].map((group) => ({
    ...group,
    selectedValues: customFilters[group.columnId] || [],
  }));

  const handleFilterChange = ({
    columnId,
    values,
  }: {
    columnId: string;
    values: string[];
  }) => {
    applyCustomFilters({ filters: { ...customFilters, [columnId]: values } });
  };

  const resultCount = table.getPrePaginatedRowModel().rows.length;

  if (isMobile) {
    return (
      <div className="space-y-2 border-b bg-white px-4 py-2.5 dark:bg-background">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <JobMobileFilters
              groups={filterGroups}
              resultCount={resultCount}
              onFilterChange={handleFilterChange}
              onReset={handleReset}
            />
          )}
          {showActions && (
            <div className="ml-auto flex items-center gap-1.5">
              <HoursInfoDialog id="hours-info-btn-mobile" />
              <CsvImportExportDropdown
                type="jobs"
                onImportSuccess={onImportSuccess}
                filters={filters}
              />
              {onAdd && !filters?.isQuickEditMode && (
                <Button
                  id="add-job-btn"
                  onClick={onAdd}
                  size="sm"
                  type="button"
                  className="h-9 rounded"
                >
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              )}
            </div>
          )}
        </div>
        {!isLoading && (
          <JobActiveFilterChips
            groups={filterGroups}
            onFilterChange={handleFilterChange}
            onReset={handleReset}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-background px-4 pb-3 pt-3 border-b">
      <div className="flex flex-wrap items-center gap-2 justify-between min-h-[2rem]">
        {/* Left side: Filters */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {isLoading ? (
            // Show skeleton filters while loading
            <>
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-20" />
              ))}
            </>
          ) : (
            <>
              {filterGroups.map((group) => (
                <CustomFacetedFilter
                  key={group.columnId}
                  columnId={group.columnId}
                  title={group.title}
                  options={group.options}
                  selectedValues={group.selectedValues}
                  onFilterChange={(values) =>
                    handleFilterChange({ columnId: group.columnId, values })
                  }
                />
              ))}
              {isFiltered && (
                <Button
                  id="reset-job-filters-btn"
                  type="button"
                  variant="ghost"
                  onClick={handleReset}
                  className="h-8 px-2 lg:px-3 flex-shrink-0 rounded"
                  size="sm"
                >
                  <span className="hidden sm:inline">Reset</span>
                  <span className="sm:hidden">Reset</span>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Right side: Action buttons */}
        {showActions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {filters?.canUseQuickEdit && filters?.onToggleQuickEdit && (
              <div className="flex items-center gap-2">
                <Switch
                  id="toggle-quick-edit-btn"
                  checked={filters.isQuickEditMode}
                  onCheckedChange={filters.onToggleQuickEdit}
                />
                <Label
                  htmlFor="toggle-quick-edit-btn"
                  className="hidden sm:inline text-sm cursor-pointer"
                >
                  Quick Edit
                </Label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <HoursInfoDialog id="hours-info-btn" showLabel />
              <CsvImportExportDropdown
                type="jobs"
                onImportSuccess={onImportSuccess}
                filters={filters}
              />
              <DataTableViewOptions table={table} />
            </div>
            {onAdd && !filters?.isQuickEditMode && (
              <Button
                id="add-job-btn"
                onClick={onAdd}
                size="sm"
                type="button"
                className="h-8 min-w-0 sm:w-auto rounded"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden xs:inline">Add Entry</span>
                <span className="xs:hidden">Add</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Table } from "@tanstack/react-table";
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
import { useState, useEffect, useCallback } from "react";
import type { Job } from "@/lib/types";
import { CsvImportExportDropdown } from "@/components/shared/csv-import-export-dropdown";
import { useSearch } from "@/contexts/search-context";

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
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleClearAll}
          title={`Clear ${title} filter`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface JobDataTableToolbarProps {
  table: Table<Job>;
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
  dataLength = 0,
  showActions = true,
}: JobDataTableToolbarProps) {
  const { debouncedSearchValue } = useSearch();
  const [dateOptions, setDateOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [driverOptions, setDriverOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [customerOptions, setCustomerOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [billToOptions, setBillToOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [registrationOptions, setRegistrationOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [truckTypeOptions, setTruckTypeOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [runsheetOptions, setRunsheetOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);
  const [invoicedOptions, setInvoicedOptions] = useState<
    { label: string; value: string; count?: number }[]
  >([]);

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
  useEffect(() => {
    // Convert custom filters to column filters format
    const columnFilters = Object.entries(customFilters)
      .map(([columnId, values]) => ({
        id: columnId,
        value: values.length > 0 ? values : undefined,
      }))
      .filter((filter) => filter.value !== undefined);

    // Apply to table column filters
    table.setColumnFilters(columnFilters);
  }, [customFilters, table]);

  // Define updateFilterOptions with useCallback to avoid changing on every render
  const updateFilterOptions = useCallback((data: Job[]) => {
    if (data.length === 0) {
      // Clear all filter options when no data
      setDateOptions([]);
      setDriverOptions([]);
      setCustomerOptions([]);
      setBillToOptions([]);
      setRegistrationOptions([]);
      setTruckTypeOptions([]);
      setRunsheetOptions([]);
      setInvoicedOptions([]);
      return;
    }

    // Helper function to count occurrences of each value
    const countValues = (values: string[]) => {
      const counts: Record<string, number> = {};
      values.forEach((value) => {
        counts[value] = (counts[value] || 0) + 1;
      });
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

    const dateOptionsFormatted = uniqueDates.map((normalizedDate) => {
      return {
        label: normalizedDate,
        value: normalizedDate,
        count: dateCounts[normalizedDate],
        displayLabel: normalizedDate,
      };
    });

    setDateOptions(dateOptionsFormatted);
    setDriverOptions(
      uniqueDrivers.map((value) => ({
        label: value,
        value,
        count: driverCounts[value],
      })),
    );
    setCustomerOptions(
      uniqueCustomers.map((value) => ({
        label: value,
        value,
        count: customerCounts[value],
      })),
    );
    setBillToOptions(
      uniqueBillTos.map((value) => ({
        label: value,
        value,
        count: billToCounts[value],
      })),
    );
    setRegistrationOptions(
      uniqueRegistrations.map((value) => ({
        label: value,
        value,
        count: registrationCounts[value],
      })),
    );
    setTruckTypeOptions(
      uniqueTruckTypes.map((value) => ({
        label: value,
        value,
        count: truckTypeCounts[value],
      })),
    );

    // Set runsheet and invoiced options with counts
    setRunsheetOptions([
      { label: "Yes", value: "true", count: runsheetCounts["true"] || 0 },
      { label: "No", value: "false", count: runsheetCounts["false"] || 0 },
    ]);
    setInvoicedOptions([
      { label: "Yes", value: "true", count: invoicedCounts["true"] || 0 },
      { label: "No", value: "false", count: invoicedCounts["false"] || 0 },
    ]);
  }, []);

  // Update filter options based on original unfiltered data
  useEffect(() => {
    // Use original data instead of filtered data to prevent options from disappearing
    const originalData = table
      .getCoreRowModel()
      .rows.map((row) => row.original);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateFilterOptions(originalData);
  }, [dataLength, table, updateFilterOptions]); // Removed customFilters from dependencies to use original data

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
              <CustomFacetedFilter
                columnId="date"
                title="Date"
                options={dateOptions}
                selectedValues={customFilters.date || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    date: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="driver"
                title="Driver"
                options={driverOptions}
                selectedValues={customFilters.driver || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    driver: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="customer"
                title="Customer"
                options={customerOptions}
                selectedValues={customFilters.customer || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    customer: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="billTo"
                title="Bill To"
                options={billToOptions}
                selectedValues={customFilters.billTo || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    billTo: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="registration"
                title="Registration"
                options={registrationOptions}
                selectedValues={customFilters.registration || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    registration: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="truckType"
                title="Truck Type"
                options={truckTypeOptions}
                selectedValues={customFilters.truckType || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    truckType: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="runsheet"
                title="Runsheet"
                options={runsheetOptions}
                selectedValues={customFilters.runsheet || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    runsheet: values,
                  }));
                }}
              />
              <CustomFacetedFilter
                columnId="invoiced"
                title="Invoiced"
                options={invoicedOptions}
                selectedValues={customFilters.invoiced || []}
                onFilterChange={(values) => {
                  setCustomFilters((prev) => ({
                    ...prev,
                    invoiced: values,
                  }));
                }}
              />
              {isFiltered && (
                <Button
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
            <div className="hidden sm:flex items-center space-x-2">
              <CsvImportExportDropdown
                type="jobs"
                onImportSuccess={onImportSuccess}
                filters={filters}
              />
              <DataTableViewOptions table={table} />
            </div>
            <div className="sm:hidden flex items-center gap-2">
              <DataTableViewOptions table={table} />
              <CsvImportExportDropdown
                type="jobs"
                onImportSuccess={onImportSuccess}
                filters={filters}
              />
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

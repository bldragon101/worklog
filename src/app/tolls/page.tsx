"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageControls } from "@/components/layout/page-controls";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableLoadingSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tollJobColumns, tollTripColumns } from "@/components/tolls/toll-columns";
import { TollJobsToolbar, TollTripsToolbar } from "@/components/tolls/toll-toolbars";
import { UnknownTagsPanel } from "@/components/tolls/unknown-tags-panel";
import {
  hasNewTrips,
  requestDriveImport,
} from "@/components/tolls/toll-drive-import-button";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { formatCurrency } from "@/lib/utils/currency";
import type { TollImportInfo, TollsResponse, TollTripRow } from "@/lib/tolls/toll-types";

const SHOW_MONTH = "__SHOW_MONTH__";

type TollsTab = "trips" | "jobs" | "tags";

const tripMobileFields = [
  { key: "tripDetails", label: "Trip", isTitle: true },
  {
    key: "registration",
    label: "Registration",
    isSubtitle: true,
    render: (_value: unknown, item: unknown) => {
      const trip = item as TollTripRow;
      return trip.registration ?? `Tag ${trip.tagNumber ?? "-"}`;
    },
  },
  {
    key: "amount",
    label: "Amount",
    render: (value: unknown) => formatCurrency({ amount: Number(value) }),
  },
  {
    key: "tripStart",
    label: "Date",
    render: (value: unknown) => {
      const iso = String(value);
      return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.substring(11, 16)}`;
    },
  },
];

/** The from/to dates (inclusive, YYYY-MM-DD) for the selected week or month */
function getSelectedRange({
  selectedYear,
  selectedMonth,
  weekEnding,
}: {
  selectedYear: number;
  selectedMonth: number;
  weekEnding: Date | string;
}): { from: string; to: string } {
  if (weekEnding === SHOW_MONTH || typeof weekEnding === "string") {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    return {
      from: format(startOfMonth(monthStart), "yyyy-MM-dd"),
      to: format(endOfMonth(monthStart), "yyyy-MM-dd"),
    };
  }
  return {
    from: format(startOfWeek(weekEnding, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    to: format(endOfWeek(weekEnding, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

function describeImport({ lastImport }: { lastImport: TollImportInfo }): string {
  const importedAt = new Date(lastImport.createdAt).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const source = lastImport.source === "drive" ? "Google Drive" : "upload";
  return `Last import ${importedAt} (${source}, ${lastImport.inserted} new)`;
}

function TollsTabs({
  activeTab,
  onTabChange,
  data,
  isCheckingDrive,
  driveError,
}: {
  activeTab: TollsTab;
  onTabChange: (tab: TollsTab) => void;
  data: TollsResponse | undefined;
  isCheckingDrive: boolean;
  driveError: string | null;
}) {
  const mismatchCount = data?.jobs.filter((job) => job.isMismatch).length ?? 0;
  const tabs: { value: TollsTab; label: string; count: number; isAlert: boolean }[] = [
    { value: "trips", label: "Trips", count: data?.trips.length ?? 0, isAlert: false },
    { value: "jobs", label: "Job check", count: mismatchCount, isAlert: mismatchCount > 0 },
    {
      value: "tags",
      label: "Unknown tags",
      count: data?.unknownTags.length ?? 0,
      isAlert: (data?.unknownTags.length ?? 0) > 0,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TollsTab)}>
        <TabsList className="h-8">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              id={`tolls-${tab.value}-tab`}
              value={tab.value}
              className="h-7 px-2 sm:px-3 text-xs sm:text-sm gap-1 sm:gap-2"
            >
              {tab.label}
              <Badge
                variant={tab.isAlert ? "destructive" : "secondary"}
                className="h-5 min-w-[20px] px-1.5 text-xs"
              >
                {tab.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="text-xs text-muted-foreground text-right">
        <div>
          {data?.lastImport
            ? describeImport({ lastImport: data.lastImport })
            : "No Linkt trips imported yet"}
        </div>
        {data && !data.driveSync.configured && (
          <div>Set the Linkt folder in Settings &gt; Integrations to import daily exports</div>
        )}
        {isCheckingDrive && <div>Checking Google Drive for new Linkt exports...</div>}
        {driveError && <div className="text-red-600">{driveError}</div>}
      </div>
    </div>
  );
}

export default function TollsPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(getYear(today));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(today));
  const [weekEnding, setWeekEnding] = useState<Date | string>(SHOW_MONTH);
  const [activeTab, setActiveTab] = useState<TollsTab>("trips");

  const { from, to } = getSelectedRange({ selectedYear, selectedMonth, weekEnding });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tolls.list({ from, to }),
    queryFn: () =>
      fetchJson<TollsResponse>({
        url: `/api/tolls?from=${from}&to=${to}`,
        fallbackMessage: "Failed to load tolls",
      }),
    placeholderData: keepPreviousData,
  });

  const refreshTolls = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tolls.all });
  };

  const driveSync = useQuery({
    queryKey: queryKeys.tollsDriveSync,
    queryFn: async () => {
      const result = await requestDriveImport({ force: false });
      if (hasNewTrips({ result })) refreshTolls();
      return result;
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const earliestYear = data?.earliestTripDate
    ? Number(data.earliestTripDate.slice(0, 4))
    : getYear(today);
  const years: number[] = [];
  for (let year = Math.min(earliestYear, selectedYear); year <= getYear(today); year++) {
    years.push(year);
  }
  if (!years.includes(selectedYear)) years.push(selectedYear);

  const lastMonth = selectedYear === getYear(today) ? getMonth(today) : 11;
  const months = Array.from({ length: lastMonth + 1 }, (_, month) => month);
  if (!months.includes(selectedMonth)) months.push(selectedMonth);

  const monthStart = new Date(selectedYear, selectedMonth, 1);
  const weekEndings = eachWeekOfInterval(
    { start: monthStart, end: endOfMonth(monthStart) },
    { weekStartsOn: 1 },
  )
    .map((weekStart) => endOfWeek(weekStart, { weekStartsOn: 1 }))
    .filter((sunday) => getMonth(sunday) === selectedMonth);

  const handleYearChange = ({ year }: { year: number }) => {
    setSelectedYear(year);
    setWeekEnding(SHOW_MONTH);
  };

  const handleMonthChange = ({ month }: { month: number }) => {
    setSelectedMonth(month);
    setWeekEnding(SHOW_MONTH);
  };

  const isFirstLoad = isLoading && !data;
  const loadFailed = isError && !data;

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredPermission="manage_tolls"
        fallbackTitle="Admin Access Required"
        fallbackDescription="You need administrator permission to view toll charges."
      >
        <div className="h-full flex flex-col">
          <div className="sticky top-0 z-30 bg-white dark:bg-background border-b">
            <PageControls
              type="tolls"
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              weekEnding={weekEnding}
              years={years}
              months={months}
              weekEndings={weekEndings}
              onYearChange={(year) => handleYearChange({ year })}
              onMonthChange={(month) => handleMonthChange({ month })}
              onWeekEndingChange={setWeekEnding}
              tabs={
                <TollsTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  data={data}
                  isCheckingDrive={driveSync.isFetching}
                  driveError={
                    driveSync.error
                      ? "Could not read the Linkt folder in Google Drive"
                      : null
                  }
                />
              }
            />
          </div>
          <div className="flex-1 overflow-hidden">
            {isFirstLoad && <TableLoadingSkeleton rows={8} columns={7} />}
            {loadFailed && (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-sm text-red-600">
                  Could not load toll trips for this period.
                </p>
                <Button
                  id="retry-load-tolls-btn"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
            {!isFirstLoad && !loadFailed && activeTab === "trips" && (
              <UnifiedDataTable
                data={data?.trips ?? []}
                columns={tollTripColumns}
                mobileFields={tripMobileFields}
                getItemId={(trip) => trip.id}
                isLoading={isLoading}
                onImportSuccess={refreshTolls}
                ToolbarComponent={TollTripsToolbar}
              />
            )}
            {!isFirstLoad && !loadFailed && activeTab === "jobs" && (
              <UnifiedDataTable
                data={data?.jobs ?? []}
                columns={tollJobColumns}
                getItemId={(job) => job.jobId}
                isLoading={isLoading}
                ToolbarComponent={TollJobsToolbar}
              />
            )}
            {!isFirstLoad && !loadFailed && activeTab === "tags" && (
              <UnknownTagsPanel tags={data?.unknownTags ?? []} onAssigned={refreshTolls} />
            )}
          </div>
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}

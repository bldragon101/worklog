import { useMemo, useState, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { JobsReport } from "@/lib/types";

const EMPTY_REPORTS: JobsReport[] = [];

/**
 * State for the jobs report "By Driver" view: the chosen driver, their
 * reports grouped by year and which years are expanded.
 */
export function useJobsReportByDriver() {
  const queryClient = useQueryClient();
  const [byDriverSelectedId, setSelectedDriverId] = useState<string>("");
  // Years the user has expanded or collapsed; null until they toggle one, so
  // the most recent year starts expanded
  const [toggledYears, setToggledYears] = useState<Set<number> | null>(null);

  const reportsKey = queryKeys.jobsReport.byDriver({
    driverId: byDriverSelectedId,
  });
  const reportsQuery = useQuery({
    queryKey: reportsKey,
    queryFn: async () => {
      try {
        const data = await fetchJson<JobsReport[]>({
          url: `/api/jobs-report?driverId=${byDriverSelectedId}`,
          init: { cache: "no-store" },
          fallbackMessage: "Failed to fetch driver reports",
        });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching driver reports:", error);
        toast({
          title: "Error",
          description: "Failed to fetch reports",
          variant: "destructive",
        });
        throw error;
      }
    },
    enabled: byDriverSelectedId !== "",
  });
  const byDriverReports =
    byDriverSelectedId && reportsQuery.data
      ? reportsQuery.data
      : EMPTY_REPORTS;
  const isLoadingByDriverReports = reportsQuery.isLoading;

  const defaultExpandedYears = useMemo(() => {
    const years = byDriverReports.map((r) =>
      parseInt(r.weekEnding.substring(0, 4), 10),
    );
    const maxYear = Math.max(...years);
    return isFinite(maxYear) ? new Set([maxYear]) : new Set<number>();
  }, [byDriverReports]);
  const byDriverExpandedYears = toggledYears ?? defaultExpandedYears;

  const setByDriverSelectedId = (driverId: string) => {
    setSelectedDriverId(driverId);
    setToggledYears(null);
  };

  /** Update the cached reports for the selected driver without refetching. */
  const setByDriverReports = (action: SetStateAction<JobsReport[]>) => {
    queryClient.setQueryData<JobsReport[]>(reportsKey, (previous = []) =>
      typeof action === "function" ? action(previous) : action,
    );
  };

  const toggleByDriverYear = ({ year }: { year: number }) => {
    const next = new Set(byDriverExpandedYears);
    if (next.has(year)) {
      next.delete(year);
    } else {
      next.add(year);
    }
    setToggledYears(next);
  };

  const byDriverGroupedReports = useMemo(() => {
    const grouped = new Map<number, JobsReport[]>();
    for (const r of byDriverReports) {
      const year = parseInt(r.weekEnding.substring(0, 4), 10);
      const existing = grouped.get(year);
      if (existing) {
        existing.push(r);
      } else {
        grouped.set(year, [r]);
      }
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, rpts]) => ({
        year,
        reports: rpts.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding)),
      }));
  }, [byDriverReports]);

  return {
    byDriverSelectedId,
    setByDriverSelectedId,
    byDriverReports,
    setByDriverReports,
    isLoadingByDriverReports,
    byDriverExpandedYears,
    toggleByDriverYear,
    byDriverGroupedReports,
  };
}

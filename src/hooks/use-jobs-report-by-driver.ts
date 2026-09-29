/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { JobsReport } from "@/lib/types";

/**
 * State for the jobs report "By Driver" view: the chosen driver, their
 * reports grouped by year and which years are expanded.
 */
export function useJobsReportByDriver() {
  const [byDriverSelectedId, setByDriverSelectedId] = useState<string>("");
  const [byDriverReports, setByDriverReports] = useState<JobsReport[]>([]);
  const [isLoadingByDriverReports, setIsLoadingByDriverReports] =
    useState(false);
  const [byDriverExpandedYears, setByDriverExpandedYears] = useState<
    Set<number>
  >(new Set());

  const fetchByDriverReports = async () => {
    if (!byDriverSelectedId) return;
    setIsLoadingByDriverReports(true);
    try {
      const response = await fetch(
        `/api/jobs-report?driverId=${byDriverSelectedId}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Failed to fetch driver reports");
      const data: unknown = await response.json();
      const driverReports: JobsReport[] = Array.isArray(data)
        ? (data as JobsReport[])
        : [];
      setByDriverReports(driverReports);

      if (driverReports.length > 0) {
        const yrs = driverReports.map((r) =>
          parseInt(r.weekEnding.substring(0, 4), 10),
        );
        const maxYear = Math.max(...yrs);
        if (isFinite(maxYear)) setByDriverExpandedYears(new Set([maxYear]));
      }
    } catch (error) {
      console.error("Error fetching driver reports:", error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive",
      });
    } finally {
      setIsLoadingByDriverReports(false);
    }
  };

  useEffect(() => {
    if (!byDriverSelectedId) return;
    void fetchByDriverReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDriverSelectedId]);

  const toggleByDriverYear = ({ year }: { year: number }) => {
    setByDriverExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
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

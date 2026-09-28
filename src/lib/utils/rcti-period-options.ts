import {
  compareAsc,
  endOfWeek,
  format,
  getMonth,
  getYear,
  parseISO,
} from "date-fns";
import type { Job } from "@/lib/types";

/**
 * Builds the year, month and week-ending options for the RCTI period controls
 * from job dates, always including the selected year and month.
 */
export function getRctiPeriodOptions({
  jobs,
  selectedYear,
  selectedMonth,
}: {
  jobs: Job[];
  selectedYear: number;
  selectedMonth: number;
}) {
  const yearsSet = new Set<number>();
  for (const job of jobs) {
    if (job.date) {
      yearsSet.add(getYear(parseISO(job.date)));
    }
  }
  yearsSet.add(selectedYear);
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  const monthsSet = new Set<number>();
  for (const job of jobs) {
    if (job.date) {
      const jobYear = getYear(parseISO(job.date));
      if (jobYear === selectedYear) {
        monthsSet.add(getMonth(parseISO(job.date)));
      }
    }
  }
  monthsSet.add(selectedMonth);
  const months = Array.from(monthsSet).sort((a, b) => a - b);

  // A week ending only appears when the week ending date itself falls in the
  // selected year and month
  const weekEndingsSet = new Set<string>();
  for (const job of jobs) {
    if (!job.date) continue;
    const jobDate = parseISO(job.date);
    const weekEnd = endOfWeek(jobDate, { weekStartsOn: 1 });

    if (
      getYear(weekEnd) === selectedYear &&
      getMonth(weekEnd) === selectedMonth
    ) {
      weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
    }
  }

  const weekEndings = Array.from(weekEndingsSet)
    .map((dateStr) => parseISO(dateStr))
    .sort((a, b) => compareAsc(a, b));

  return { years, months, weekEndings };
}

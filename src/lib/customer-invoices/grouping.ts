import {
  addDaysToIsoDate,
  getJobCalendarDay,
  getWeekEndingSundayIsoDate,
} from "@/lib/utils/jobs-report-dates";
import { formatShortDate } from "@/lib/customer-invoices/line-builder";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/**
 * The calendar day (YYYY-MM-DD) of a stored date. Job dates are saved either
 * as UTC midnight or as Melbourne midnight in UTC (13:00/14:00 the day
 * before), so the date is rounded to the nearest midnight.
 */
export function toIsoDate({ date }: { date: Date | string }): string {
  return getJobCalendarDay({
    isoDate: typeof date === "string" ? date : date.toISOString(),
  });
}

export function isIsoDate({ value }: { value: string }): boolean {
  return ISO_DATE_REGEX.test(value);
}

/** The Sunday ending the week a job falls in, as YYYY-MM-DD */
export function getInvoiceWeekEnding({ jobDate }: { jobDate: Date | string }): string {
  return getWeekEndingSundayIsoDate({ isoDate: toIsoDate({ date: jobDate }) });
}

/** A week ending as stored on a customer invoice */
export function weekEndingToDate({ weekEnding }: { weekEnding: string }): Date {
  return new Date(`${weekEnding}T00:00:00.000Z`);
}

/**
 * The stored job dates in a week, Monday to Sunday. Each bound is moved back
 * half a day so a date saved as Melbourne midnight (the previous day at
 * 13:00/14:00 UTC) falls in the same week as one saved as UTC midnight.
 */
export function getInvoiceWeekRange({ weekEnding }: { weekEnding: string }): {
  gte: Date;
  lt: Date;
} {
  const monday = weekEndingToDate({
    weekEnding: addDaysToIsoDate({ isoDate: weekEnding, days: -6 }),
  });
  const nextMonday = weekEndingToDate({
    weekEnding: addDaysToIsoDate({ isoDate: weekEnding, days: 1 }),
  });
  return {
    gte: new Date(monday.getTime() - HALF_DAY_MS),
    lt: new Date(nextMonday.getTime() - HALF_DAY_MS),
  };
}

/** Collapses spacing and case so "Bowens  Cheltenham" and "bowens cheltenham" match */
export function normaliseName({ value }: { value: string | null | undefined }): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The reference group of a job, or null when the customer is not split by
 * reference or the job has no reference.
 */
export function getReferenceGroup({
  jobReference,
  separateInvoicesByReference,
}: {
  jobReference: string | null;
  separateInvoicesByReference: boolean;
}): string | null {
  if (!separateInvoicesByReference) return null;
  const key = normaliseName({ value: jobReference });
  return key === "" ? null : key;
}

/**
 * The invoice reference: the run or customer name without spaces and the week
 * ending, e.g. "BowensCheltenham-01/11/26".
 */
export function buildInvoiceReference({
  label,
  weekEnding,
}: {
  label: string;
  weekEnding: string;
}): string {
  return `${label.replace(/\s+/g, "")}-${formatShortDate({ isoDate: weekEnding })}`;
}

/** Key of an automatic draft: one per customer, week and reference group */
export function buildAutomaticInvoiceKey({
  customerKey,
  weekEnding,
  referenceGroup,
}: {
  customerKey: string;
  weekEnding: string;
  referenceGroup: string | null;
}): string {
  return `auto:${customerKey}:${weekEnding}:${referenceGroup ?? ""}`;
}

export interface AutomaticInvoiceGroup<Job> {
  key: string;
  /** Normalised customer name the jobs were entered under */
  customerKey: string;
  referenceGroup: string | null;
  /** The reference as first entered on a job, for display */
  jobReference: string | null;
  jobs: Job[];
}

/**
 * Groups a week's uninvoiced jobs into automatic drafts: one per customer, or
 * one per customer and job reference for customers split by reference. Jobs
 * without a reference stay on the customer's main draft.
 */
export function groupJobsIntoAutomaticInvoices<
  Job extends { customer: string; jobReference: string | null },
>({
  jobs,
  weekEnding,
  isSeparatedByReference,
}: {
  jobs: Job[];
  weekEnding: string;
  isSeparatedByReference: ({ customerKey }: { customerKey: string }) => boolean;
}): AutomaticInvoiceGroup<Job>[] {
  const groups = new Map<string, AutomaticInvoiceGroup<Job>>();

  for (const job of jobs) {
    const customerKey = normaliseName({ value: job.customer });
    const referenceGroup = getReferenceGroup({
      jobReference: job.jobReference,
      separateInvoicesByReference: isSeparatedByReference({ customerKey }),
    });
    const key = buildAutomaticInvoiceKey({ customerKey, weekEnding, referenceGroup });
    const group = groups.get(key);
    if (group) {
      group.jobs.push(job);
    } else {
      groups.set(key, {
        key,
        customerKey,
        referenceGroup,
        jobReference: referenceGroup ? (job.jobReference?.trim() ?? null) : null,
        jobs: [job],
      });
    }
  }

  return [...groups.values()];
}

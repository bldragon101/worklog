import { format } from "date-fns";
import {
  addDaysToIsoDate,
  formatIsoDate,
  getMelbourneTodayIsoDate,
  getWeekEndingSundayIsoDate,
} from "@/lib/utils/jobs-report-dates";
import { formatCurrency } from "@/lib/utils/currency";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The most recent Sunday on or before a YYYY-MM-DD date */
export function getLatestSundayOnOrBefore({ isoDate }: { isoDate: string }): string {
  const sunday = getWeekEndingSundayIsoDate({ isoDate });
  return sunday === isoDate ? sunday : addDaysToIsoDate({ isoDate: sunday, days: -7 });
}

/** The default invoice week: the most recent Sunday on or before today in Melbourne */
export function getDefaultInvoiceWeekEnding(): string {
  return getLatestSundayOnOrBefore({ isoDate: getMelbourneTodayIsoDate() });
}

/**
 * The week ending Sunday for a requested YYYY-MM-DD date, or null when the
 * value is not a valid date. A weekday moves to the Sunday that ends its week.
 */
export function normaliseInvoiceWeekEnding({
  value,
}: {
  value: string | null | undefined;
}): string | null {
  if (!value || !ISO_DATE_PATTERN.test(value)) return null;
  // addDaysToIsoDate returns an invalid date (e.g. 2026-02-30) unchanged
  if (addDaysToIsoDate({ isoDate: value, days: 1 }) === value) return null;
  return getWeekEndingSundayIsoDate({ isoDate: value });
}

/** Every Sunday (YYYY-MM-DD) in a month */
export function getSundaysInMonth({
  year,
  monthIndex,
}: {
  year: number;
  monthIndex: number;
}): string[] {
  const firstOfMonth = formatIsoDate({ year, monthIndex, day: 1 });
  const monthPrefix = firstOfMonth.slice(0, 7);
  const sundays: string[] = [];
  for (
    let sunday = getWeekEndingSundayIsoDate({ isoDate: firstOfMonth });
    sunday.startsWith(monthPrefix);
    sunday = addDaysToIsoDate({ isoDate: sunday, days: 7 })
  ) {
    sundays.push(sunday);
  }
  return sundays;
}

/**
 * The week to open when a year or month is picked: the month's latest week
 * ending on or before the default week, or its first when the whole month is
 * later.
 */
export function getInvoiceWeekForMonth({
  year,
  monthIndex,
  defaultWeekEnding,
}: {
  year: number;
  monthIndex: number;
  defaultWeekEnding: string;
}): string {
  const sundays = getSundaysInMonth({ year, monthIndex });
  const pastSundays = sundays.filter((sunday) => sunday <= defaultWeekEnding);
  return pastSundays.at(-1) ?? sundays[0];
}

/** Years offered before the default week's year */
const PAST_YEARS_OFFERED = 3;

/**
 * Options for the year, month and week ending selects. A week belongs to the
 * month and year its Sunday falls in, as on the jobs page.
 */
export function getInvoicePeriodOptions({
  weekEnding,
  defaultWeekEnding,
}: {
  weekEnding: string;
  defaultWeekEnding: string;
}): {
  selectedYear: number;
  selectedMonth: number;
  years: number[];
  months: number[];
  weekEndings: string[];
} {
  const selectedYear = Number(weekEnding.slice(0, 4));
  const selectedMonth = Number(weekEnding.slice(5, 7)) - 1;
  const defaultYear = Number(defaultWeekEnding.slice(0, 4));
  const years = [
    ...new Set([
      ...Array.from(
        { length: PAST_YEARS_OFFERED + 1 },
        (_, index) => defaultYear - PAST_YEARS_OFFERED + index,
      ),
      selectedYear,
    ]),
  ].sort((a, b) => a - b);

  return {
    selectedYear,
    selectedMonth,
    years,
    months: Array.from({ length: 12 }, (_, index) => index),
    weekEndings: getSundaysInMonth({ year: selectedYear, monthIndex: selectedMonth }),
  };
}

/**
 * A week ending picked in the select as YYYY-MM-DD. The select gives a local
 * date from `parseISO`, so formatting it keeps the same calendar day.
 */
export function toSelectedWeekEnding({ value }: { value: Date | string }): string {
  return typeof value === "string" ? value.slice(0, 10) : format(value, "yyyy-MM-dd");
}

/** A break deduction key ("Tray|120") as "Tray at $120.00/h" */
export function describeBreakKey({ breakKey }: { breakKey: string }): string {
  const separator = breakKey.lastIndexOf("|");
  if (separator === -1) return breakKey;
  const truckType = breakKey.slice(0, separator);
  const rate = Number(breakKey.slice(separator + 1));
  if (!Number.isFinite(rate)) return truckType;
  return `${truckType} at ${formatCurrency({ amount: rate })}/h`;
}

/** The reference suggested for jobs split out of an invoice */
export function getSplitReference({ reference }: { reference: string }): string {
  return reference ? `${reference}-Adhoc` : "Adhoc";
}

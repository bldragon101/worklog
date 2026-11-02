import {
  addDaysToIsoDate,
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

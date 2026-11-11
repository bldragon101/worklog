/** Most RCTIs one statement may cover */
export const MAX_STATEMENT_RCTIS = 60;

/** RCTI statuses that can appear on a statement or be re-sent */
export const STATEMENT_ELIGIBLE_STATUSES = ["finalised", "paid"] as const;

export function isStatementEligibleStatus({
  status,
}: {
  status: string;
}): boolean {
  return (STATEMENT_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

export interface StatementRctiInput {
  id: number;
  invoiceNumber: string;
  weekEnding: string;
  status: string;
  paidAt: string | null;
  subtotal: number;
  gst: number;
  total: number;
  deductionApplications?: Array<{
    amount: number;
    deduction: { type: string };
  }>;
}

export interface StatementRow {
  id: number;
  invoiceNumber: string;
  weekEnding: string;
  status: string;
  paidAt: string | null;
  subtotal: number;
  gst: number;
  /** Total including GST, before deductions and reimbursements */
  grossTotal: number;
  /** Reimbursements minus deductions applied to the RCTI */
  adjustments: number;
  /** Amount payable to the driver */
  amountPayable: number;
}

export interface StatementTotals {
  count: number;
  subtotal: number;
  gst: number;
  grossTotal: number;
  adjustments: number;
  amountPayable: number;
  paid: number;
  paidCount: number;
  outstanding: number;
  outstandingCount: number;
}

export interface RctiStatement {
  rows: StatementRow[];
  totals: StatementTotals;
  periodStart: string | null;
  periodEnd: string | null;
}

function roundCents({ value }: { value: number }): number {
  return Math.round(value * 100) / 100;
}

function netAdjustment({
  deductionApplications,
}: {
  deductionApplications: StatementRctiInput["deductionApplications"];
}): number {
  let net = 0;
  for (const app of deductionApplications ?? []) {
    if (app.deduction.type === "reimbursement") net += app.amount;
    if (app.deduction.type === "deduction") net -= app.amount;
  }
  return roundCents({ value: net });
}

/**
 * Builds the rows and totals of a driver statement. Rows are ordered by week
 * ending, oldest first. An RCTI's stored total already includes its applied
 * deductions and reimbursements, so the gross total is recovered from it.
 */
export function buildRctiStatement({
  rctis,
}: {
  rctis: StatementRctiInput[];
}): RctiStatement {
  const rows: StatementRow[] = [...rctis]
    .sort((a, b) => {
      const byWeek = a.weekEnding
        .slice(0, 10)
        .localeCompare(b.weekEnding.slice(0, 10));
      return byWeek !== 0
        ? byWeek
        : a.invoiceNumber.localeCompare(b.invoiceNumber);
    })
    .map((rcti) => {
      const adjustments = netAdjustment({
        deductionApplications: rcti.deductionApplications,
      });
      return {
        id: rcti.id,
        invoiceNumber: rcti.invoiceNumber,
        weekEnding: rcti.weekEnding,
        status: rcti.status,
        paidAt: rcti.paidAt,
        subtotal: rcti.subtotal,
        gst: rcti.gst,
        grossTotal: roundCents({ value: rcti.total - adjustments }),
        adjustments,
        amountPayable: rcti.total,
      };
    });

  const totals: StatementTotals = {
    count: rows.length,
    subtotal: 0,
    gst: 0,
    grossTotal: 0,
    adjustments: 0,
    amountPayable: 0,
    paid: 0,
    paidCount: 0,
    outstanding: 0,
    outstandingCount: 0,
  };

  for (const row of rows) {
    totals.subtotal += row.subtotal;
    totals.gst += row.gst;
    totals.grossTotal += row.grossTotal;
    totals.adjustments += row.adjustments;
    totals.amountPayable += row.amountPayable;
    if (row.status === "paid") {
      totals.paid += row.amountPayable;
      totals.paidCount += 1;
    } else {
      totals.outstanding += row.amountPayable;
      totals.outstandingCount += 1;
    }
  }

  for (const key of [
    "subtotal",
    "gst",
    "grossTotal",
    "adjustments",
    "amountPayable",
    "paid",
    "outstanding",
  ] as const) {
    totals[key] = roundCents({ value: totals[key] });
  }

  return {
    rows,
    totals,
    periodStart: rows.length > 0 ? rows[0].weekEnding : null,
    periodEnd: rows.length > 0 ? rows[rows.length - 1].weekEnding : null,
  };
}

/** Formats the date portion of an ISO string as DD/MM/YYYY without timezone conversion */
export function formatStatementDate({
  isoString,
}: {
  isoString: string;
}): string {
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoString;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Today's date in Melbourne as YYYY-MM-DD */
export function getMelbourneTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Formats a recorded moment (such as when an RCTI was paid) as a Melbourne date, DD/MM/YYYY */
export function formatMelbourneDate({
  isoString,
}: {
  isoString: string;
}): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(isoString));
  const part = ({ type }: { type: string }) =>
    parts.find((p) => p.type === type)?.value;
  const day = part({ type: "day" });
  const month = part({ type: "month" });
  const year = part({ type: "year" });
  return `${day}/${month}/${year}`;
}

/** Describes the weeks a statement covers, e.g. "W/E 05/01/2026 - 28/09/2026" */
export function formatStatementPeriod({
  periodStart,
  periodEnd,
}: {
  periodStart: string | null;
  periodEnd: string | null;
}): string {
  if (!periodStart || !periodEnd) return "";
  const start = formatStatementDate({ isoString: periodStart });
  const end = formatStatementDate({ isoString: periodEnd });
  return start === end ? `W/E ${start}` : `W/E ${start} - ${end}`;
}

/**
 * Subject line for an email carrying a statement, or (when the statement is
 * left out) only copies of RCTIs
 */
export function buildRctiStatementEmailSubject({
  periodStart,
  periodEnd,
  companyName,
  includeStatement,
}: {
  periodStart: string | null;
  periodEnd: string | null;
  companyName: string | null;
  includeStatement: boolean;
}): string {
  const period = formatStatementPeriod({ periodStart, periodEnd });
  const label = includeStatement ? "RCTI Statement" : "RCTIs";
  const base = period ? `${label} ${period}` : label;
  const trimmedCompanyName = (companyName ?? "").trim();
  return trimmedCompanyName ? `${base} from ${trimmedCompanyName}` : base;
}

/**
 * File name for a statement PDF, e.g. "Statement-John-Smith-2026-01-05-to-2026-09-28.pdf",
 * or "RCTIs-..." for a file of full RCTIs without the statement
 */
export function buildRctiStatementFilename({
  driverName,
  periodStart,
  periodEnd,
  includeStatement,
}: {
  driverName: string;
  periodStart: string | null;
  periodEnd: string | null;
  includeStatement: boolean;
}): string {
  const prefix = includeStatement ? "Statement" : "RCTIs";
  const safeName =
    driverName
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "Driver";
  if (!periodStart || !periodEnd) return `${prefix}-${safeName}.pdf`;
  const start = periodStart.slice(0, 10);
  const end = periodEnd.slice(0, 10);
  return start === end
    ? `${prefix}-${safeName}-${start}.pdf`
    : `${prefix}-${safeName}-${start}-to-${end}.pdf`;
}

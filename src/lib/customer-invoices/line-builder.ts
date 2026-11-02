import {
  bankersRound,
  calculateLineAmounts,
  calculateRctiTotals,
  formatTimeFromIso,
  getBreakDeductionKey,
} from "@/lib/utils/rcti-calculations";
import { formatCountryRunCharge } from "@/lib/utils/country-run";
import type { TollRates } from "@/lib/utils/toll-rates";
import type {
  CustomerInvoiceLine,
  CustomerInvoiceTotals,
  CustomerInvoiceWarning,
  TollRoad,
  TruckClass,
} from "@/lib/customer-invoices/types";

/** Jobs over this many charged hours have a break deducted, as on RCTIs */
export const BREAK_THRESHOLD_HOURS = 7;

export interface InvoiceJobInput {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  driver: string;
  registration: string;
  truckType: string;
  pickup: string;
  dropoff: string | null;
  jobReference: string | null;
  chargedHours: number | null;
  startTime: Date | string | null;
  finishTime: Date | string | null;
  eastlink: number | null;
  citylink: number | null;
  countryRunValue: number | null;
  countryRunUnit: string | null;
  hasRunsheet: boolean;
}

export interface InvoiceCustomerInput {
  tray: number | null;
  crane: number | null;
  semi: number | null;
  semiCrane: number | null;
  fuelLevy: number | null;
  tolls: boolean;
  breakDeduction: number | null;
}

const TRUCK_CLASS_LABELS: Record<TruckClass, string> = {
  tray: "Tray",
  crane: "Crane",
  semi: "Semi",
  semiCrane: "Semi Crane",
};

/**
 * The rate class of a job's truck type, or null when it is not one of the
 * four charged classes (e.g. a ute or tautliner). Unlike the RCTI rate lookup
 * there is no fallback to tray, so an unknown type is flagged rather than
 * charged at the wrong rate.
 */
export function getTruckClass({ truckType }: { truckType: string }): TruckClass | null {
  const normalised = truckType.toLowerCase();
  const isSemi = normalised.includes("semi") || normalised.includes("prime");
  if (isSemi && normalised.includes("crane")) return "semiCrane";
  if (isSemi) return "semi";
  if (normalised.includes("crane")) return "crane";
  if (normalised.includes("tray")) return "tray";
  return null;
}

/** DD/MM/YY from a YYYY-MM-DD date */
export function formatShortDate({ isoDate }: { isoDate: string }): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(2, 4)}`;
}

function amountsFor({ quantity, unitAmount }: { quantity: number; unitAmount: number }) {
  return calculateLineAmounts({
    chargedHours: quantity,
    ratePerHour: unitAmount,
    gstStatus: "registered",
    gstMode: "exclusive",
  });
}

function emptyLineFields(): Pick<
  CustomerInvoiceLine,
  | "jobId"
  | "jobDate"
  | "truckType"
  | "truckClass"
  | "registration"
  | "driver"
  | "breakKey"
  | "tollRoad"
  | "fuelLevyPercent"
> {
  return {
    jobId: null,
    jobDate: null,
    truckType: null,
    truckClass: null,
    registration: null,
    driver: null,
    breakKey: null,
    tollRoad: null,
    fuelLevyPercent: null,
  };
}

/**
 * A job line's description, laid out like the job's "Copy details" text:
 *
 *   02/11/26 - 06:00-14:00
 *   Driver: Sam Driver
 *   Melbourne CBD to Footscray
 *   Job Ref: JOB-001
 *
 * A country run is added on its own line, as it changes the hours or rate.
 * Tolls have their own invoice lines and comments are internal, so neither is
 * included.
 */
export function describeJob({ job }: { job: InvoiceJobInput }): string {
  const start = formatTimeFromIso({ isoString: job.startTime });
  const finish = formatTimeFromIso({ isoString: job.finishTime });
  const lines = [
    `${formatShortDate({ isoDate: job.date })}${start && finish ? ` - ${start}-${finish}` : ""}`,
    `Driver: ${job.driver}`,
  ];

  const route = [job.pickup, job.dropoff].filter(Boolean).join(" to ");
  if (route) lines.push(route);
  if (job.jobReference) lines.push(`Job Ref: ${job.jobReference}`);
  if (job.countryRunValue && job.countryRunValue > 0) {
    const unit = job.countryRunUnit === "percentage" ? "percentage" : "hours";
    lines.push(`Country run + ${formatCountryRunCharge({ value: job.countryRunValue, unit })}`);
  }
  return lines.join("\n");
}

function buildJobLine({
  job,
  customer,
  warnings,
}: {
  job: InvoiceJobInput;
  customer: InvoiceCustomerInput;
  warnings: CustomerInvoiceWarning[];
}): CustomerInvoiceLine {
  const truckClass = getTruckClass({ truckType: job.truckType });
  const baseRate = truckClass ? customer[truckClass] : null;

  if (!truckClass) {
    warnings.push({
      code: "unknown_truck_type",
      jobId: job.id,
      message: `Truck type "${job.truckType}" is not Tray, Crane, Semi or Semi Crane, so it has no rate`,
    });
  } else if (!baseRate) {
    warnings.push({
      code: "missing_rate",
      jobId: job.id,
      message: `The customer has no ${TRUCK_CLASS_LABELS[truckClass]} rate`,
    });
  }

  if (job.chargedHours === null) {
    warnings.push({
      code: "missing_hours",
      jobId: job.id,
      message: "The job has no charged hours",
    });
  }

  const countryRun = job.countryRunValue && job.countryRunValue > 0 ? job.countryRunValue : 0;
  const isPercentageRun = job.countryRunUnit === "percentage";
  const quantity = bankersRound(
    (job.chargedHours ?? 0) + (countryRun && !isPercentageRun ? countryRun : 0),
  );
  const unitAmount = bankersRound(
    (baseRate ?? 0) * (countryRun && isPercentageRun ? 1 + countryRun / 100 : 1),
  );

  return {
    ...emptyLineFields(),
    kind: "job",
    jobId: job.id,
    jobDate: job.date,
    truckType: job.truckType,
    truckClass,
    registration: job.registration,
    driver: job.driver,
    description: describeJob({ job }),
    quantity,
    unitAmount,
    ...amountsFor({ quantity, unitAmount }),
  };
}

/**
 * One negative line per truck type and rate, for the jobs over the break
 * threshold. A job's charged hours are judged before any country run hours are
 * added, as the RCTI judges a job on its charged hours.
 */
function buildBreakLines({
  jobs,
  jobLines,
  breakHours,
  waivedBreakDeductions,
}: {
  jobs: InvoiceJobInput[];
  jobLines: CustomerInvoiceLine[];
  breakHours: number | null;
  waivedBreakDeductions: readonly string[];
}): CustomerInvoiceLine[] {
  if (!breakHours || breakHours <= 0) return [];

  const groups = new Map<string, { truckType: string; rate: number; jobCount: number }>();
  for (const [index, job] of jobs.entries()) {
    const line = jobLines[index];
    if ((job.chargedHours ?? 0) <= BREAK_THRESHOLD_HOURS || line.unitAmount <= 0) continue;

    const breakKey = getBreakDeductionKey({
      truckType: job.truckType,
      ratePerHour: line.unitAmount,
    });
    if (waivedBreakDeductions.includes(breakKey)) continue;

    const existing = groups.get(breakKey);
    if (existing) {
      existing.jobCount += 1;
    } else {
      groups.set(breakKey, { truckType: job.truckType, rate: line.unitAmount, jobCount: 1 });
    }
  }

  return [...groups.entries()].map(([breakKey, group]) => {
    const quantity = -bankersRound(group.jobCount * breakHours);
    return {
      ...emptyLineFields(),
      kind: "break" as const,
      truckType: group.truckType,
      truckClass: getTruckClass({ truckType: group.truckType }),
      breakKey,
      description: `Breaks - ${group.truckType} (${group.jobCount} × ${breakHours}h)`,
      quantity,
      unitAmount: group.rate,
      ...amountsFor({ quantity, unitAmount: group.rate }),
    };
  });
}

function buildTollLines({
  jobs,
  tollRates,
}: {
  jobs: InvoiceJobInput[];
  tollRates: TollRates;
}): CustomerInvoiceLine[] {
  const roads: Array<{ road: TollRoad; label: string; count: number }> = [
    {
      road: "eastlink",
      label: "Eastlink",
      count: jobs.reduce((sum, job) => sum + (job.eastlink ?? 0), 0),
    },
    {
      road: "citylink",
      label: "CityLink",
      count: jobs.reduce((sum, job) => sum + (job.citylink ?? 0), 0),
    },
  ];

  return roads
    .filter(({ count }) => count > 0)
    .map(({ road, label, count }) => ({
      ...emptyLineFields(),
      kind: "toll" as const,
      tollRoad: road,
      description: `${label} tolls`,
      quantity: count,
      unitAmount: tollRates[road],
      ...amountsFor({ quantity: count, unitAmount: tollRates[road] }),
    }));
}

/**
 * Builds a customer invoice's lines from its jobs: one line per job, break
 * deductions, tolls (when the customer is charged tolls) and a fuel levy on
 * the jobs after breaks. Amounts are GST exclusive with 10% GST.
 */
export function buildCustomerInvoiceLines({
  jobs,
  customer,
  tollRates,
  waivedBreakDeductions = [],
}: {
  jobs: InvoiceJobInput[];
  customer: InvoiceCustomerInput;
  tollRates: TollRates;
  waivedBreakDeductions?: readonly string[];
}): { lines: CustomerInvoiceLine[]; warnings: CustomerInvoiceWarning[] } {
  const warnings: CustomerInvoiceWarning[] = [];
  const sortedJobs = [...jobs].sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date),
  );

  for (const job of sortedJobs) {
    if (!job.hasRunsheet) {
      warnings.push({
        code: "missing_runsheet",
        jobId: job.id,
        message: "No runsheet is attached",
      });
    }
  }

  const jobLines = sortedJobs.map((job) => buildJobLine({ job, customer, warnings }));
  const breakLines = buildBreakLines({
    jobs: sortedJobs,
    jobLines,
    breakHours: customer.breakDeduction,
    waivedBreakDeductions,
  });
  const tollLines = customer.tolls ? buildTollLines({ jobs: sortedJobs, tollRates }) : [];

  const fuelLevyLines: CustomerInvoiceLine[] = [];
  if (customer.fuelLevy && customer.fuelLevy > 0) {
    const levyBase = [...jobLines, ...breakLines].reduce(
      (sum, line) => sum + line.amountExGst,
      0,
    );
    const unitAmount = bankersRound((levyBase * customer.fuelLevy) / 100);
    if (unitAmount !== 0) {
      fuelLevyLines.push({
        ...emptyLineFields(),
        kind: "fuelLevy",
        fuelLevyPercent: customer.fuelLevy,
        description: `Fuel levy ${customer.fuelLevy}%`,
        quantity: 1,
        unitAmount,
        ...amountsFor({ quantity: 1, unitAmount }),
      });
    }
  }

  return {
    lines: [...jobLines, ...breakLines, ...tollLines, ...fuelLevyLines],
    warnings,
  };
}

export function calculateInvoiceTotals({
  lines,
}: {
  lines: CustomerInvoiceLine[];
}): CustomerInvoiceTotals {
  return calculateRctiTotals(lines);
}

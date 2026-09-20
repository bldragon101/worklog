/**
 * RCTI Calculation Utilities
 * Handles GST calculations and totals with banker's rounding
 */

// Type-safe Decimal handling that works in both client and server contexts
type DecimalLike = number | { toNumber: () => number };

/**
 * Helper function to convert Prisma Decimal or Decimal-like objects to number
 * Safe for reading from database - works with any object that has toNumber() method
 */
export function toNumber(value: DecimalLike): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

/**
 * Helper function to convert number to Decimal
 * Note: This returns the number as-is since we can't import Prisma in client code
 * Server-side code should handle Decimal conversion when writing to database
 */
export function toDecimal(value: number): number {
  return value;
}

// Type aliases for GST enums - compatible with Prisma enums but safe for client
export type GstMode = "exclusive" | "inclusive";
export type GstStatus = "not_registered" | "registered";

/**
 * Types for Job and Driver matching Prisma schema
 */
export interface Job {
  id: number;
  date: Date | string;
  driver: string;
  customer: string;
  truckType: string;
  driverCharge: number | null;
  chargedHours: number | null;
  travelTimeHours: number | null;
  deductionHours?: number | null;
  startTime: Date | string | null;
  finishTime: Date | string | null;
  jobReference: string | null;
  comments: string | null;
}

export interface Driver {
  type: string;
  tray: DecimalLike | null;
  crane: DecimalLike | null;
  semi: DecimalLike | null;
  semiCrane: DecimalLike | null;
}

export interface RctiLineData {
  jobId: number;
  jobDate: Date;
  customer: string;
  truckType: string;
  description: string;
  chargedHours: number;
  travelTimeHours: number;
  driverCharge: number;
  ratePerHour: number;
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
}

export interface RctiLineFromDb {
  jobId: number | null;
  truckType: string;
  chargedHours: DecimalLike;
  travelTimeHours?: DecimalLike | null;
  driverCharge?: DecimalLike | null;
  ratePerHour: DecimalLike;
  amountExGst?: DecimalLike;
  gstAmount?: DecimalLike;
  amountIncGst?: DecimalLike;
}

/**
 * Banker's rounding (round half to even) to 2 decimal places
 * This is the preferred rounding method for financial calculations
 * Uses Intl.NumberFormat with halfEven mode to avoid floating-point precision errors
 */
const bankersFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
  roundingMode: "halfEven",
});

export function bankersRound(value: number): number {
  return Number(bankersFormatter.format(value));
}

/**
 * Calculate line amounts based on GST status and mode
 */
export interface LineCalculationParams {
  chargedHours: number;
  ratePerHour: number;
  gstStatus: GstStatus;
  gstMode: GstMode;
}

export interface LineCalculationResult {
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
}

export function isNonTimeRctiLine({
  customer,
}: {
  customer: string;
}): boolean {
  return customer === "Tolls" || customer === "Fuel Levy";
}

/**
 * Tolerance used when comparing hour values, to avoid floating-point noise
 * being reported as a deduction or addition.
 */
const DRIVER_HOURS_EPSILON = 0.001;

export interface DriverHoursInput {
  chargedHours: DecimalLike | null;
  travelTimeHours: DecimalLike | null | undefined;
  driverCharge: DecimalLike | null | undefined;
  /** Hours withheld from the driver for this job. */
  deductionHours?: DecimalLike | null;
  /** Adjustment carried by an existing resolved line when its base changes. */
  hoursAdjustment?: DecimalLike | null;
}


export function getTotalDriverHours({
  chargedHours,
  travelTimeHours,
  driverCharge,
  deductionHours,
  hoursAdjustment,
}: DriverHoursInput): number {
  const jobHours = chargedHours == null ? 0 : toNumber(chargedHours);
  const travelHours = travelTimeHours == null ? 0 : toNumber(travelTimeHours);
  const baseHours = jobHours + travelHours;

  let total = baseHours;

  if (driverCharge != null) {
    const override = toNumber(driverCharge);
    total = override < 0 ? baseHours + override : override;
  }

  const deduction = deductionHours == null ? 0 : toNumber(deductionHours);
  total -= deduction;

  const adjustment =
    hoursAdjustment == null ? 0 : toNumber(hoursAdjustment);
  total += adjustment;

  const rounded = bankersRound(total);
  const wasAdjusted =
    driverCharge != null || deduction !== 0 || adjustment !== 0;

  if (wasAdjusted && rounded < 0) {
    return 0;
  }

  return rounded;
}

export interface LineDriverHoursInput {
  chargedHours: DecimalLike | null;
  travelTimeHours: DecimalLike | null | undefined;
  /** Resolved driver hours stored on the line, if any. */
  driverCharge: DecimalLike | null | undefined;
}

/**
 * Resolve the hours paid on an RCTI or jobs-report line.
 *
 * On these models `driverCharge` holds the **resolved total** captured when the
 * line was built, not an adjustment, so it is used as-is. Break deductions,
 * negative manual lines and any other signed line therefore keep their sign -
 * clamping them would silently turn a credit into a zero-value line.
 */
export function getLineDriverHours({
  chargedHours,
  travelTimeHours,
  driverCharge,
}: LineDriverHoursInput): number {
  if (driverCharge != null) {
    return bankersRound(toNumber(driverCharge));
  }

  const jobHours = chargedHours == null ? 0 : toNumber(chargedHours);
  const travelHours = travelTimeHours == null ? 0 : toNumber(travelTimeHours);
  return bankersRound(jobHours + travelHours);
}

export interface DriverHoursBreakdown {
  /** Hours charged to the customer. */
  chargedHours: number;
  /** Travel hours paid on top of charged hours. */
  travelHours: number;
  /** Charged plus travel hours - what the driver is paid without adjustments. */
  baseHours: number;
  /** Hours the driver is actually paid for. */
  totalDriverHours: number;
  /** Driver hours relative to charged hours (negative when hours are deducted). */
  deltaFromCharged: number;
  /** Hours withheld relative to charged plus travel hours (never negative). */
  deductionHours: number;
  /** True when the driver is paid less than charged plus travel hours. */
  hasDeduction: boolean;
  /** True when the record carries an explicit driver hours total. */
  isOverridden: boolean;
}

/**
 * Break down how a job's driver hours were arrived at, so callers can show a
 * deduction or addition indicator without repeating the comparison logic.
 */
export function getDriverHoursBreakdown({
  chargedHours,
  travelTimeHours,
  driverCharge,
  deductionHours,
}: DriverHoursInput): DriverHoursBreakdown {
  const jobHours = chargedHours == null ? 0 : toNumber(chargedHours);
  const travelHours = travelTimeHours == null ? 0 : toNumber(travelTimeHours);
  const baseHours = bankersRound(jobHours + travelHours);
  const totalDriverHours = getTotalDriverHours({
    chargedHours,
    travelTimeHours,
    driverCharge,
    deductionHours,
  });
  const withheldHours = bankersRound(Math.max(0, baseHours - totalDriverHours));

  return {
    chargedHours: jobHours,
    travelHours,
    baseHours,
    totalDriverHours,
    deltaFromCharged: bankersRound(totalDriverHours - jobHours),
    deductionHours: withheldHours,
    hasDeduction: withheldHours > DRIVER_HOURS_EPSILON,
    isOverridden: driverCharge != null,
  };
}

export interface LineDriverHoursBreakdown {
  /** Hours charged on the line. */
  chargedHours: number;
  /** Travel hours on the line. */
  travelHours: number;
  /** Charged plus travel hours. */
  baseHours: number;
  /** Hours the driver is paid for this line, signed. */
  totalDriverHours: number;
  /** Hours withheld relative to charged plus travel hours (never negative). */
  deductionHours: number;
  /** Signed adjustment relative to charged plus travel hours. */
  adjustmentFromBase: number;
  /** True when the line pays less than its charged plus travel hours. */
  hasDeduction: boolean;
}

/**
 * Break down the hours on an RCTI or jobs-report line so a deduction carried
 * over from the source job can be shown, and re-applied when the line's hours
 * are edited.
 *
 * The deduction is derived rather than stored: a line keeps its charged and
 * travel hours alongside the resolved driver total, so the difference between
 * them is the deduction that was applied when the line was built.
 */
export function getLineDriverHoursBreakdown({
  chargedHours,
  travelTimeHours,
  driverCharge,
}: LineDriverHoursInput): LineDriverHoursBreakdown {
  const jobHours = chargedHours == null ? 0 : toNumber(chargedHours);
  const travelHours = travelTimeHours == null ? 0 : toNumber(travelTimeHours);
  const baseHours = bankersRound(jobHours + travelHours);
  const totalDriverHours = getLineDriverHours({
    chargedHours,
    travelTimeHours,
    driverCharge,
  });
  const withheldHours = bankersRound(Math.max(0, baseHours - totalDriverHours));

  return {
    chargedHours: jobHours,
    travelHours,
    baseHours,
    totalDriverHours,
    deductionHours: withheldHours,
    adjustmentFromBase: bankersRound(totalDriverHours - baseHours),
    hasDeduction: withheldHours > DRIVER_HOURS_EPSILON,
  };
}

export function calculateLineAmounts({
  chargedHours,
  ratePerHour,
  gstStatus,
  gstMode,
}: LineCalculationParams): LineCalculationResult {
  if (gstStatus === "not_registered") {
    // No GST registered: ex-GST = inc-GST
    const amount = bankersRound(chargedHours * ratePerHour);
    return {
      amountExGst: amount,
      gstAmount: 0,
      amountIncGst: amount,
    };
  }

  if (gstMode === "exclusive") {
    // GST exclusive: add 10% GST on top
    const amountExGst = bankersRound(chargedHours * ratePerHour);
    const gstAmount = bankersRound(amountExGst * 0.1);
    const amountIncGst = bankersRound(amountExGst + gstAmount);
    return {
      amountExGst,
      gstAmount,
      amountIncGst,
    };
  }

  // GST inclusive: back-calculate ex-GST from inc-GST
  const amountIncGst = bankersRound(chargedHours * ratePerHour);
  const amountExGst = bankersRound(amountIncGst / 1.1);
  const gstAmount = bankersRound(amountIncGst - amountExGst);
  return {
    amountExGst,
    gstAmount,
    amountIncGst,
  };
}

/**
 * Calculate RCTI totals from lines
 */
export interface RctiLine {
  amountExGst: DecimalLike;
  gstAmount: DecimalLike;
  amountIncGst: DecimalLike;
}

export interface RctiTotals {
  subtotal: number;
  gst: number;
  total: number;
}

export function calculateRctiTotals(lines: RctiLine[]): RctiTotals {
  const subtotal = bankersRound(
    lines.reduce((sum, line) => sum + toNumber(line.amountExGst), 0),
  );
  const gst = bankersRound(
    lines.reduce((sum, line) => sum + toNumber(line.gstAmount), 0),
  );
  const total = bankersRound(
    lines.reduce((sum, line) => sum + toNumber(line.amountIncGst), 0),
  );

  return {
    subtotal,
    gst,
    total,
  };
}

/**
 * Generate unique invoice number
 * Format: RCTI-DDMMYYYY (e.g., RCTI-20012025)
 */
export function generateInvoiceNumber(
  existingNumbers: string[],
  weekEnding: Date,
  driverOrBusinessName: string,
): string {
  const date = new Date(weekEnding);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString();
  const dateStr = `${day}${month}${year}`;

  // Extract first 10 characters of business/driver name, sanitize for invoice number
  const safeName = driverOrBusinessName || "";
  const namePart = safeName
    .substring(0, 10)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const baseNumber = `RCTI-${dateStr}-${namePart}`;

  // Check if base number exists
  if (!existingNumbers.includes(baseNumber)) {
    return baseNumber;
  }

  // Find next available number with suffix
  let counter = 1;
  let candidateNumber = `${baseNumber}-${counter}`;
  while (existingNumbers.includes(candidateNumber)) {
    counter++;
    candidateNumber = `${baseNumber}-${counter}`;
  }

  return candidateNumber;
}

/**
 * Get driver rate by truck type
 */
export function getDriverRateForTruckType({
  truckType,
  tray,
  crane,
  semi,
  semiCrane,
}: {
  truckType: string;
  tray: DecimalLike | null;
  crane: DecimalLike | null;
  semi: DecimalLike | null;
  semiCrane: DecimalLike | null;
}): number | null {
  const normalizedType = truckType.toLowerCase().trim();

  let rate: DecimalLike | null = null;

  if (normalizedType.includes("semi") && normalizedType.includes("crane")) {
    rate = semiCrane;
  } else if (normalizedType.includes("semi")) {
    rate = semi;
  } else if (normalizedType.includes("crane")) {
    rate = crane;
  } else if (normalizedType.includes("tray")) {
    rate = tray;
  } else {
    // Default fallback
    rate = tray;
  }

  return rate !== null ? toNumber(rate) : null;
}

/**
 * Calculate lunch break deduction lines grouped by truck type
 *
 * Rules:
 * - Only applies to jobs with chargedHours > 7 (not exactly 7)
 * - Only applies to imported jobs (jobId !== null)
 * - Groups breaks by truck type
 * - Uses driver's rate for that truck type
 * - Creates negative line items
 */
export type JobLineForBreaks = RctiLineFromDb;

export interface BreakLineData {
  truckType: string;
  totalBreakHours: number;
  ratePerHour: number;
  description: string;
}

export function calculateLunchBreakLines({
  lines,
  driverBreakHours,
  gstStatus,
  gstMode,
}: {
  lines: JobLineForBreaks[];
  driverBreakHours: number | null;
  gstStatus: GstStatus;
  gstMode: GstMode;
}): Array<BreakLineData & LineCalculationResult> {
  // No breaks if driver has null/0 break hours
  if (!driverBreakHours || driverBreakHours <= 0) {
    return [];
  }

  // Filter to only imported jobs (jobId !== null) with chargedHours > 7
  const eligibleJobs = lines.filter(
    (line) => line.jobId !== null && toNumber(line.chargedHours) > 7,
  );

  if (eligibleJobs.length === 0) {
    return [];
  }

  // Group by composite key of truck type and rate per hour
  const breaksByTruckTypeAndRate = new Map<
    string,
    { truckType: string; hours: number; rate: number }
  >();

  for (const job of eligibleJobs) {
    // Create composite key using truckType and ratePerHour
    const ratePerHour = toNumber(job.ratePerHour);
    const compositeKey = `${job.truckType}|${ratePerHour}`;
    const existing = breaksByTruckTypeAndRate.get(compositeKey);
    if (existing) {
      // Same truck type and rate - add to existing break hours
      existing.hours += driverBreakHours;
    } else {
      // New truck type/rate combination - create new entry
      breaksByTruckTypeAndRate.set(compositeKey, {
        truckType: job.truckType,
        hours: driverBreakHours,
        rate: ratePerHour,
      });
    }
  }

  // Create break line data for each truck type and rate combination
  const breakLines: Array<BreakLineData & LineCalculationResult> = [];

  for (const [, data] of breaksByTruckTypeAndRate) {
    const description = `Lunch Breaks - ${data.truckType}`;

    // Calculate amounts with negative hours
    const amounts = calculateLineAmounts({
      chargedHours: -data.hours, // Negative for deduction
      ratePerHour: data.rate,
      gstStatus,
      gstMode,
    });

    breakLines.push({
      truckType: data.truckType,
      totalBreakHours: data.hours,
      ratePerHour: data.rate,
      description,
      ...amounts,
    });
  }

  return breakLines;
}

/**
 * Format time from ISO string to HH:mm format
 * Extracts HH:mm directly from ISO string without timezone conversion
 */
export function formatTimeFromIso({
  isoString,
}: {
  isoString: string | Date | null;
}): string {
  if (!isoString) return "";

  const isoStr =
    typeof isoString === "string" ? isoString : isoString.toISOString();
  // Extract HH:mm directly from ISO string (position 11-16)
  return isoStr.substring(11, 16);
}

/**
 * Build RCTI line description from job times and driver info
 */
export function buildRctiLineDescription({
  job,
  driver,
}: {
  job: {
    driver: string;
    startTime: Date | string | null;
    finishTime: Date | string | null;
    jobReference: string | null;
    comments: string | null;
  };
  driver: {
    type: string;
  };
}): string {
  const startTime = formatTimeFromIso({ isoString: job.startTime });
  const finishTime = formatTimeFromIso({ isoString: job.finishTime });

  if (startTime && finishTime) {
    return driver.type === "Subcontractor"
      ? `${job.driver} | ${startTime} - ${finishTime}`
      : `${startTime} - ${finishTime}`;
  }

  let description = job.jobReference || job.comments || "";
  if (driver.type === "Subcontractor" && job.driver) {
    description = `${job.driver}${description ? " | " + description : ""}`;
  }
  return description;
}

/**
 * Convert a job to RCTI line data
 * Extracts duplicated logic from job-to-line conversion
 */
export function convertJobToRctiLine({
  job,
  driver,
  gstStatus,
  gstMode,
}: {
  job: Job;
  driver: Driver;
  gstStatus: GstStatus;
  gstMode: GstMode;
}): RctiLineData {
  const jobHours = toNumber(job.chargedHours || 0);
  const travelTimeHours = toNumber(job.travelTimeHours || 0);
  const totalDriverHours = getTotalDriverHours({
    chargedHours: jobHours,
    travelTimeHours,
    driverCharge: job.driverCharge,
    deductionHours: job.deductionHours,
  });

  // Always use job.truckType for display (Tray, Crane, Semi, etc.)
  const truckType = job.truckType;

  // Get rate from driver's truck type rates
  const rate =
    getDriverRateForTruckType({
      truckType: job.truckType,
      tray: driver.tray,
      crane: driver.crane,
      semi: driver.semi,
      semiCrane: driver.semiCrane,
    }) || 0;

  const amounts = calculateLineAmounts({
    chargedHours: totalDriverHours,
    ratePerHour: rate,
    gstStatus,
    gstMode,
  });

  const description = buildRctiLineDescription({ job, driver });

  return {
    jobId: job.id,
    jobDate: new Date(job.date),
    customer: job.customer || "Unknown",
    truckType: truckType || "",
    description,
    chargedHours: jobHours,
    travelTimeHours,
    driverCharge: totalDriverHours,
    ratePerHour: rate,
    amountExGst: amounts.amountExGst,
    gstAmount: amounts.gstAmount,
    amountIncGst: amounts.amountIncGst,
  };
}

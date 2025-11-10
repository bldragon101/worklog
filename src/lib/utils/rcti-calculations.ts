/**
 * RCTI Calculation Utilities
 * Handles GST calculations and totals with banker's rounding
 */

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
  gstStatus: "registered" | "not_registered";
  gstMode: "exclusive" | "inclusive";
}

export interface LineCalculationResult {
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
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
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
}

export interface RctiTotals {
  subtotal: number;
  gst: number;
  total: number;
}

export function calculateRctiTotals(lines: RctiLine[]): RctiTotals {
  const subtotal = bankersRound(
    lines.reduce((sum, line) => sum + Number(line.amountExGst), 0),
  );
  const gst = bankersRound(
    lines.reduce((sum, line) => sum + Number(line.gstAmount), 0),
  );
  const total = bankersRound(
    lines.reduce((sum, line) => sum + Number(line.amountIncGst), 0),
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
  tray: number | null;
  crane: number | null;
  semi: number | null;
  semiCrane: number | null;
}): number | null {
  const normalizedType = truckType.toLowerCase().trim();

  if (normalizedType.includes("semi") && normalizedType.includes("crane")) {
    return semiCrane;
  }
  if (normalizedType.includes("semi")) {
    return semi;
  }
  if (normalizedType.includes("crane")) {
    return crane;
  }
  if (normalizedType.includes("tray")) {
    return tray;
  }

  // Default fallback
  return tray;
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
export interface JobLineForBreaks {
  jobId: number | null;
  truckType: string;
  chargedHours: number;
  ratePerHour: number;
}

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
  gstStatus: "registered" | "not_registered";
  gstMode: "exclusive" | "inclusive";
}): Array<BreakLineData & LineCalculationResult> {
  // No breaks if driver has null/0 break hours
  if (!driverBreakHours || driverBreakHours <= 0) {
    return [];
  }

  // Filter to only imported jobs (jobId !== null) with chargedHours > 7
  const eligibleJobs = lines.filter(
    (line) => line.jobId !== null && line.chargedHours > 7,
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
    const compositeKey = `${job.truckType}|${job.ratePerHour}`;
    const existing = breaksByTruckTypeAndRate.get(compositeKey);
    if (existing) {
      // Same truck type and rate - add to existing break hours
      existing.hours += driverBreakHours;
    } else {
      // New truck type/rate combination - create new entry
      breaksByTruckTypeAndRate.set(compositeKey, {
        truckType: job.truckType,
        hours: driverBreakHours,
        rate: job.ratePerHour,
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

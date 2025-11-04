/**
 * RCTI Calculation Utilities
 * Handles GST calculations and totals with banker's rounding
 */

/**
 * Banker's rounding (round half to even) to 2 decimal places
 * This is the preferred rounding method for financial calculations
 */
export function bankersRound(value: number): number {
  const factor = 100;
  const scaled = value * factor;
  const floored = Math.floor(scaled);
  const remainder = scaled - floored;

  if (remainder < 0.5) {
    return floored / factor;
  } else if (remainder > 0.5) {
    return (floored + 1) / factor;
  } else {
    // Round to even
    if (floored % 2 === 0) {
      return floored / factor;
    } else {
      return (floored + 1) / factor;
    }
  }
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
    lines.reduce((sum, line) => sum + line.amountExGst, 0),
  );
  const gst = bankersRound(
    lines.reduce((sum, line) => sum + line.gstAmount, 0),
  );
  const total = bankersRound(
    lines.reduce((sum, line) => sum + line.amountIncGst, 0),
  );

  return {
    subtotal,
    gst,
    total,
  };
}

/**
 * Generate unique invoice number
 * Format: RCTI-YYYYMMDD-NNNN (e.g., RCTI-20250120-0001)
 */
export function generateInvoiceNumber(existingNumbers: string[]): string {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

  // Find highest sequence number for today
  const todayPattern = new RegExp(`^RCTI-${dateStr}-(\\d{4})$`);
  let maxSequence = 0;

  for (const num of existingNumbers) {
    const match = num.match(todayPattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSequence) {
        maxSequence = seq;
      }
    }
  }

  const nextSequence = maxSequence + 1;
  const sequenceStr = nextSequence.toString().padStart(4, "0");

  return `RCTI-${dateStr}-${sequenceStr}`;
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

  // Group by truck type and sum break hours
  const breaksByTruckType = new Map<string, { hours: number; rate: number }>();

  for (const job of eligibleJobs) {
    const existing = breaksByTruckType.get(job.truckType);
    if (existing) {
      // Same truck type - add to existing break hours
      existing.hours += driverBreakHours;
    } else {
      // New truck type - create new entry
      breaksByTruckType.set(job.truckType, {
        hours: driverBreakHours,
        rate: job.ratePerHour,
      });
    }
  }

  // Create break line data for each truck type
  const breakLines: Array<BreakLineData & LineCalculationResult> = [];

  for (const [truckType, data] of breaksByTruckType) {
    const description = `Lunch Breaks - ${truckType}`;

    // Calculate amounts with negative hours
    const amounts = calculateLineAmounts({
      chargedHours: -data.hours, // Negative for deduction
      ratePerHour: data.rate,
      gstStatus,
      gstMode,
    });

    breakLines.push({
      truckType,
      totalBreakHours: data.hours,
      ratePerHour: data.rate,
      description,
      ...amounts,
    });
  }

  return breakLines;
}

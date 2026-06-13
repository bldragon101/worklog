/**
 * Shared RCTI line-building logic.
 *
 * Given a set of eligible jobs and a driver, builds the full set of
 * auto-generated RCTI lines: job lines, lunch-break deductions, toll lines
 * and a fuel levy line. This is the single source of truth used both when
 * creating a new RCTI and when refreshing an existing draft from source jobs.
 */
import {
  calculateLineAmounts,
  calculateLunchBreakLines,
  convertJobToRctiLine,
  toNumber,
} from "@/lib/utils/rcti-calculations";
import type { GstMode, GstStatus } from "@/lib/utils/rcti-calculations";

// Toll rates (dollars per toll crossing)
export const TOLL_RATE_EASTLINK = 18.5;
export const TOLL_RATE_CITYLINK = 31;

// Customer labels used to identify system-generated (non-manual) lines
export const BREAK_DEDUCTION_CUSTOMER = "Break Deduction";
export const TOLLS_CUSTOMER = "Tolls";
export const FUEL_LEVY_CUSTOMER = "Fuel Levy";

/**
 * Customer labels for lines that are generated automatically (not entered by
 * hand). Any line with a null jobId whose customer is NOT in this set is
 * treated as a manually-added line and preserved across refreshes.
 */
export const SYSTEM_LINE_CUSTOMERS: ReadonlySet<string> = new Set([
  BREAK_DEDUCTION_CUSTOMER,
  TOLLS_CUSTOMER,
  FUEL_LEVY_CUSTOMER,
]);

type DecimalLike = number | { toNumber: () => number };

export interface JobForLines {
  id: number;
  date: Date | string;
  driver: string;
  customer: string;
  truckType: string;
  driverCharge: number | null;
  chargedHours: number | null;
  startTime: Date | string | null;
  finishTime: Date | string | null;
  jobReference: string | null;
  comments: string | null;
  eastlink?: number | null;
  citylink?: number | null;
}

export interface DriverForLines {
  type: string;
  tray: DecimalLike | null;
  crane: DecimalLike | null;
  semi: DecimalLike | null;
  semiCrane: DecimalLike | null;
  breaks: number | null;
  tolls: boolean;
  fuelLevy: number | null;
}

export interface BuiltRctiLine {
  jobId: number | null;
  jobDate: Date;
  customer: string;
  truckType: string;
  description: string | null;
  chargedHours: number;
  ratePerHour: number;
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
}

/**
 * Build all auto-generated RCTI lines from the given eligible jobs.
 *
 * Returns job lines, lunch-break deduction lines, toll lines and a fuel levy
 * line in display order. Manual lines are NOT produced here - callers are
 * responsible for preserving any manually-added lines.
 */
export function buildRctiLinesFromJobs({
  eligibleJobs,
  driver,
  weekEndingDate,
  gstStatus,
  gstMode,
}: {
  eligibleJobs: JobForLines[];
  driver: DriverForLines;
  weekEndingDate: Date;
  gstStatus: GstStatus;
  gstMode: GstMode;
}): BuiltRctiLine[] {
  // Job lines
  const lineData = eligibleJobs.map((job) =>
    convertJobToRctiLine({
      job,
      driver: {
        type: driver.type,
        tray: driver.tray,
        crane: driver.crane,
        semi: driver.semi,
        semiCrane: driver.semiCrane,
      },
      gstStatus,
      gstMode,
    }),
  );

  // Lunch break deduction lines (grouped by truck type)
  const breakLines = calculateLunchBreakLines({
    lines: lineData.map((line) => ({
      jobId: line.jobId,
      truckType: line.truckType,
      chargedHours: line.chargedHours,
      ratePerHour: line.ratePerHour,
    })),
    driverBreakHours: driver.breaks,
    gstStatus,
    gstMode,
  });

  const breakLineData: BuiltRctiLine[] = breakLines.map((breakLine) => ({
    jobId: null,
    jobDate: weekEndingDate,
    customer: BREAK_DEDUCTION_CUSTOMER,
    truckType: breakLine.truckType,
    description: breakLine.description,
    chargedHours: -breakLine.totalBreakHours,
    ratePerHour: breakLine.ratePerHour,
    amountExGst: breakLine.amountExGst,
    gstAmount: breakLine.gstAmount,
    amountIncGst: breakLine.amountIncGst,
  }));

  // Toll lines (only if driver has tolls enabled)
  const tollLines: BuiltRctiLine[] = [];
  if (driver.tolls) {
    const totalEastlink = eligibleJobs.reduce(
      (sum, job) => sum + (job.eastlink || 0),
      0,
    );
    const totalCitylink = eligibleJobs.reduce(
      (sum, job) => sum + (job.citylink || 0),
      0,
    );

    if (totalEastlink > 0) {
      const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;
      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: eastlinkAmount,
        gstStatus,
        gstMode,
      });

      tollLines.push({
        jobId: null,
        jobDate: weekEndingDate,
        customer: TOLLS_CUSTOMER,
        truckType: "Eastlink",
        description: `${totalEastlink} × $${TOLL_RATE_EASTLINK.toFixed(2)}`,
        chargedHours: totalEastlink,
        ratePerHour: TOLL_RATE_EASTLINK,
        amountExGst: tollAmounts.amountExGst,
        gstAmount: tollAmounts.gstAmount,
        amountIncGst: tollAmounts.amountIncGst,
      });
    }

    if (totalCitylink > 0) {
      const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;
      const tollAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: citylinkAmount,
        gstStatus,
        gstMode,
      });

      tollLines.push({
        jobId: null,
        jobDate: weekEndingDate,
        customer: TOLLS_CUSTOMER,
        truckType: "CityLink",
        description: `${totalCitylink} × $${TOLL_RATE_CITYLINK.toFixed(2)}`,
        chargedHours: totalCitylink,
        ratePerHour: TOLL_RATE_CITYLINK,
        amountExGst: tollAmounts.amountExGst,
        gstAmount: tollAmounts.gstAmount,
        amountIncGst: tollAmounts.amountIncGst,
      });
    }
  }

  // Fuel levy line (only if driver has a fuel levy percentage set)
  const fuelLevyLines: BuiltRctiLine[] = [];
  if (driver.fuelLevy && driver.fuelLevy > 0) {
    const jobLinesSubtotal = lineData.reduce(
      (sum, line) => sum + toNumber(line.amountExGst),
      0,
    );

    const fuelLevyAmount = (jobLinesSubtotal * driver.fuelLevy) / 100;
    const fuelLevyAmounts = calculateLineAmounts({
      chargedHours: 1,
      ratePerHour: fuelLevyAmount,
      gstStatus,
      gstMode,
    });

    fuelLevyLines.push({
      jobId: null,
      jobDate: weekEndingDate,
      customer: FUEL_LEVY_CUSTOMER,
      truckType: `${driver.fuelLevy}%`,
      description: `${driver.fuelLevy}% of $${jobLinesSubtotal.toFixed(2)}`,
      chargedHours: 1,
      ratePerHour: fuelLevyAmount,
      amountExGst: fuelLevyAmounts.amountExGst,
      gstAmount: fuelLevyAmounts.gstAmount,
      amountIncGst: fuelLevyAmounts.amountIncGst,
    });
  }

  return [...lineData, ...breakLineData, ...tollLines, ...fuelLevyLines];
}

/**
 * Determine whether an existing RCTI line was added manually (and so should be
 * preserved across a refresh). Manual lines have no jobId and a customer that
 * is not one of the system-generated labels.
 */
export function isManualRctiLine({
  jobId,
  customer,
}: {
  jobId: number | null;
  customer: string;
}): boolean {
  return jobId === null && !SYSTEM_LINE_CUSTOMERS.has(customer);
}

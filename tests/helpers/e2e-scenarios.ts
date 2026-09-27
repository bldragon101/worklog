import { addDays, endOfWeek, format, subWeeks } from "date-fns";
import type { Pool } from "pg";
import { E2E_NAME_PREFIX, E2E_REGISTRATION_PREFIX } from "./e2e-db";

type SqlValue = string | number | boolean | Date | null;

export interface E2eDriver {
  id: number;
  driver: string;
  truck: string;
}

/**
 * Inserts one row and returns it. Timestamps are filled in because Prisma,
 * not the database, maintains `updatedAt`.
 */
async function insertRow<TRow>({
  db,
  table,
  values,
}: {
  db: Pool;
  table: string;
  values: Record<string, SqlValue | undefined>;
}): Promise<TRow> {
  const entries = Object.entries({ updatedAt: new Date(), ...values }).filter(
    ([, value]) => value !== undefined,
  );
  const columns = entries.map(([column]) => `"${column}"`).join(", ");
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db.query(
    `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`,
    entries.map(([, value]) => value),
  );
  return result.rows[0] as TRow;
}

export interface E2eWeek {
  /** Sunday that ends the week, as the RCTI and jobs report pages use. */
  weekEnding: Date;
  /** Week option label on the RCTI and jobs report pages, e.g. "Sep 13". */
  weekEndingLabel: string;
}

/**
 * A Monday-to-Sunday week a given number of weeks before the current one.
 */
export function getE2eWeek({ weeksAgo }: { weeksAgo: number }): E2eWeek {
  const weekEnding = endOfWeek(subWeeks(new Date(), weeksAgo), {
    weekStartsOn: 1,
  });
  weekEnding.setHours(12, 0, 0, 0);
  return { weekEnding, weekEndingLabel: format(weekEnding, "MMM dd") };
}

/**
 * Midday on a day of the week (0 = Monday), so the date falls in the same
 * week whether the server runs in Melbourne time or UTC.
 */
export function getE2eJobDate({
  week,
  day,
}: {
  week: E2eWeek;
  day: number;
}): Date {
  const date = addDays(week.weekEnding, day - 6);
  date.setHours(12, 0, 0, 0);
  return date;
}

/**
 * Start and finish times on a job date, from hour numbers.
 */
export function getE2eJobTimes({
  date,
  startHour,
  finishHour,
}: {
  date: Date;
  startHour: number;
  finishHour: number;
}): { startTime: Date; finishTime: Date } {
  const startTime = new Date(date);
  startTime.setHours(startHour, 0, 0, 0);
  const finishTime = new Date(date);
  finishTime.setHours(finishHour, 0, 0, 0);
  return { startTime, finishTime };
}

export function buildE2eDriverName({
  tag,
  key,
}: {
  tag: string;
  key: string;
}): string {
  return `${E2E_NAME_PREFIX} ${tag} ${key}`.toUpperCase();
}

export function buildE2eRegistration({
  tag,
  key,
}: {
  tag: string;
  key: string;
}): string {
  return `${E2E_REGISTRATION_PREFIX}${tag}-${key}`.toUpperCase();
}

/**
 * Creates a driver named and registered with the spec's tag. Defaults to a
 * GST-registered subcontractor on exclusive GST with no breaks, tolls or fuel
 * levy, so each spec opts in to exactly the rules it tests.
 */
export async function createE2eDriver({
  db,
  tag,
  key,
  overrides = {},
}: {
  db: Pool;
  tag: string;
  key: string;
  overrides?: Record<string, SqlValue>;
}): Promise<E2eDriver> {
  return insertRow<E2eDriver>({
    db,
    table: "Driver",
    values: {
      driver: buildE2eDriverName({ tag, key }),
      truck: buildE2eRegistration({ tag, key }),
      type: "Subcontractor",
      tray: 70,
      crane: 90,
      semi: 100,
      semiCrane: 120,
      breaks: null,
      tolls: false,
      fuelLevy: null,
      email: `${tag.toLowerCase()}-${key.toLowerCase()}@e2e.example.com`,
      businessName: `${E2E_NAME_PREFIX} ${tag} ${key} Pty Ltd`,
      abn: "51824753556",
      address: "1 Test Street, Melbourne VIC 3000",
      bankAccountName: `${E2E_NAME_PREFIX} ${tag} ${key}`,
      bankBsb: "063000",
      bankAccountNumber: "12345678",
      gstStatus: "registered",
      gstMode: "exclusive",
      ...overrides,
    },
  });
}

/**
 * Creates jobs for a driver. Each job defaults to the driver's name and
 * truck, a tray run between metro suburbs, and a customer named with the tag.
 */
export async function createE2eJobs({
  db,
  tag,
  driver,
  jobs,
}: {
  db: Pool;
  tag: string;
  driver: E2eDriver;
  jobs: Array<Record<string, SqlValue> & { date: Date }>;
}): Promise<Array<{ id: number }>> {
  const customer = `${E2E_NAME_PREFIX} ${tag} Customer`;
  return Promise.all(
    jobs.map((job) =>
      insertRow<{ id: number }>({
        db,
        table: "Jobs",
        values: {
          driver: driver.driver,
          registration: driver.truck,
          customer,
          billTo: customer,
          truckType: "TRAY",
          pickup: "Dandenong",
          dropoff: "Richmond",
          runsheet: true,
          invoiced: false,
          ...job,
        },
      }),
    ),
  );
}

/**
 * Creates an active RCTI deduction or reimbursement for a driver.
 */
export async function createE2eDeduction({
  db,
  driverId,
  type,
  description,
  totalAmount,
  frequency,
  startDate,
  amountPerCycle = null,
}: {
  db: Pool;
  driverId: number;
  type: "deduction" | "reimbursement";
  description: string;
  totalAmount: number;
  frequency: "once" | "weekly" | "fortnightly" | "monthly";
  startDate: Date;
  amountPerCycle?: number | null;
}): Promise<{ id: number }> {
  return insertRow<{ id: number }>({
    db,
    table: "RctiDeduction",
    values: {
      driverId,
      type,
      description,
      totalAmount,
      amountPaid: 0,
      amountRemaining: totalAmount,
      frequency,
      amountPerCycle,
      startDate,
      status: "active",
    },
  });
}

#!/usr/bin/env tsx
/**
 * Download recent trips from the Linkt portal and import them.
 *
 * Usage:
 *   pnpm exec tsx scripts/linkt/sync-linkt-trips.ts [--days 14]
 *   pnpm exec tsx scripts/linkt/sync-linkt-trips.ts --from 2026-09-01 --to 2026-09-30
 *
 * Needs LINKT_USERNAME, LINKT_PASSWORD and DATABASE_URL. Trips already
 * imported are skipped, so the overlap between runs is safe; Linkt can take
 * several days to post a trip, which is why the default looks back 14 days.
 */
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true, quiet: true });

const DEFAULT_DAYS = 14;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readArg({ name }: { name: string }): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main() {
  const { addDaysToIsoDate, getMelbourneTodayIsoDate } = await import(
    "../../src/lib/utils/jobs-report-dates"
  );
  const { parseLinktTripsCsv } = await import("../../src/lib/tolls/linkt-csv");
  const { importTollTrips } = await import("../../src/lib/tolls/import-toll-trips");
  const { prisma } = await import("../../src/lib/prisma");
  const { downloadLinktTrips } = await import("./linkt-client");

  const today = getMelbourneTodayIsoDate();
  const days = Number(readArg({ name: "days" }) ?? DEFAULT_DAYS);
  const to = readArg({ name: "to" }) ?? today;
  const from = readArg({ name: "from" }) ?? addDaysToIsoDate({ isoDate: to, days: -(days - 1) });
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
    throw new Error("Use --from and --to as YYYY-MM-DD with from on or before to");
  }

  try {
    console.log(`Downloading Linkt trips from ${from} to ${to}`);
    const exports = await downloadLinktTrips({ from, to });
    const parsed = exports.map(({ csv }) => parseLinktTripsCsv({ text: csv }));
    const errors = parsed.flatMap((result) => result.errors);
    for (const error of errors) console.warn(error);

    const trips = parsed.flatMap((result) => result.trips);
    if (trips.length === 0) {
      console.log("Linkt returned no trips for this period");
      return;
    }

    const summary = await importTollTrips({
      trips,
      source: "scheduled",
      fileName: `linkt-sync-${from}-to-${to}`,
      createdBy: process.env.GITHUB_ACTIONS ? "github-actions" : "linkt-sync",
    });
    console.log(
      `Imported ${summary.inserted} new trips (${summary.duplicates} already imported, ${errors.length} unreadable).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Linkt sync failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

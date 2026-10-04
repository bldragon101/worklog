#!/usr/bin/env tsx
/**
 * Download recent trips from the Linkt portal into one CSV file. It does not
 * touch any database: the scheduled GitHub Action copies the file to Google
 * Drive and each environment imports it from there.
 *
 * Usage:
 *   pnpm exec tsx scripts/linkt/download-linkt-trips.ts --out <dir> [--days 14]
 *   pnpm exec tsx scripts/linkt/download-linkt-trips.ts --out <dir> --from 2026-09-01 --to 2026-09-30
 *
 * Needs LINKT_USERNAME and LINKT_PASSWORD. Linkt can take several days to
 * post a trip, which is why the default looks back 14 days; trips already
 * imported are skipped on import, so the overlap between runs is safe.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import {
  addDaysToIsoDate,
  getMelbourneTodayIsoDate,
} from "../../src/lib/utils/jobs-report-dates";
import { combineLinktCsvExports, downloadLinktTrips } from "./linkt-client";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const DEFAULT_DAYS = 14;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readArg({ name }: { name: string }): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main() {
  const outDir = readArg({ name: "out" });
  if (!outDir) throw new Error("Pass the folder to save the CSV in with --out <dir>");

  const days = Number(readArg({ name: "days" }) ?? DEFAULT_DAYS);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("--days must be a whole number of at least 1");
  }
  const to = readArg({ name: "to" }) ?? getMelbourneTodayIsoDate();
  const from = readArg({ name: "from" }) ?? addDaysToIsoDate({ isoDate: to, days: -(days - 1) });
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
    throw new Error("Use --from and --to as YYYY-MM-DD with from on or before to");
  }

  console.log(`Downloading Linkt trips from ${from} to ${to}`);
  const exports = await downloadLinktTrips({ from, to });
  const csv = combineLinktCsvExports({ csvs: exports.map((linktExport) => linktExport.csv) });
  const tripCount = Math.max(csv.split("\n").filter(Boolean).length - 1, 0);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const filePath = path.join(outDir, `linkt-trips_${from}_to_${to}_${stamp}.csv`);
  await mkdir(outDir, { recursive: true });
  await writeFile(filePath, csv);
  console.log(`Saved ${tripCount} trips to ${filePath}`);
}

main().catch((error: unknown) => {
  console.error("Linkt download failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

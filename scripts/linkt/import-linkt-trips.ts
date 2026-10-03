#!/usr/bin/env tsx
/**
 * Import a Linkt trips CSV export into the TollTrip table.
 *
 * Usage:
 *   pnpm exec tsx scripts/linkt/import-linkt-trips.ts --file <path-to-csv> [--source upload|scheduled]
 *
 * Trips already imported are skipped, so overlapping exports are safe.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

function readArg({ name }: { name: string }): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main() {
  const filePath = readArg({ name: "file" });
  const source = readArg({ name: "source" }) === "scheduled" ? "scheduled" : "upload";
  if (!filePath) {
    throw new Error("Pass the Linkt CSV export with --file <path>");
  }

  const { parseLinktTripsCsv } = await import("../../src/lib/tolls/linkt-csv");
  const { importTollTrips } = await import("../../src/lib/tolls/import-toll-trips");
  const { prisma } = await import("../../src/lib/prisma");

  try {
    const { trips, errors, totalRows } = parseLinktTripsCsv({
      text: await readFile(filePath, "utf8"),
    });
    for (const error of errors) console.warn(error);
    if (trips.length === 0) {
      throw new Error(errors[0] ?? "The file has no trips to import");
    }

    const summary = await importTollTrips({
      trips,
      source,
      fileName: path.basename(filePath),
      createdBy: source === "scheduled" ? "github-actions" : null,
    });
    console.log(
      `Imported ${summary.inserted} new trips (${summary.duplicates} already imported, ${errors.length} unreadable) from ${totalRows} rows covering ${summary.periodFrom?.slice(0, 10)} to ${summary.periodTo?.slice(0, 10)}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Linkt import failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

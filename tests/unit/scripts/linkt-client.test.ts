/**
 * @vitest-environment node
 */
import { parseLinktTripsCsv } from "@/lib/tolls/linkt-csv";
import {
  combineLinktCsvExports,
  splitDateRange,
} from "../../../scripts/linkt/linkt-client";

describe("splitDateRange", () => {
  it("splits a range into 7-day windows that end on the last day", () => {
    expect(splitDateRange({ from: "2026-09-21", to: "2026-10-04" })).toEqual([
      { from: "2026-09-21", to: "2026-09-27" },
      { from: "2026-09-28", to: "2026-10-04" },
    ]);
  });

  it("shortens the last window and handles a single day", () => {
    expect(splitDateRange({ from: "2026-12-29", to: "2027-01-06" })).toEqual([
      { from: "2026-12-29", to: "2027-01-04" },
      { from: "2027-01-05", to: "2027-01-06" },
    ]);
    expect(splitDateRange({ from: "2026-10-04", to: "2026-10-04" })).toEqual([
      { from: "2026-10-04", to: "2026-10-04" },
    ]);
  });
});

describe("combineLinktCsvExports", () => {
  const header =
    "Trip Start date,Trip Details,LPN,Tag Number,Vehicle Class,Trip Cost,Trip End date";

  it("keeps one header and drops each export's footer", () => {
    const first = `﻿${header}\r\n02/10/2026 14:57,Punt Rd to Swan St,1EA6QC,,HCV,-$20.44,02/10/2026 14:59\r\nTotal of 1 results exported\r\n`;
    const second = `${header}\n25/09/2026 08:00,EL Police Rd to Melba Tunnel,,242302021843,HCV,-$7.11,25/09/2026 08:05\nTotal of 1 results exported\n`;
    const empty = `${header}\nTotal of 0 results exported\n`;

    const combined = combineLinktCsvExports({ csvs: [first, empty, second] });
    const { trips, errors } = parseLinktTripsCsv({ text: combined });

    expect(combined.split("\n").filter((line) => line === header)).toHaveLength(1);
    expect(combined).not.toMatch(/Total of/);
    expect(errors).toEqual([]);
    expect(trips.map((trip) => trip.tripDetails)).toEqual([
      "Punt Rd to Swan St",
      "EL Police Rd to Melba Tunnel",
    ]);
  });

  it("returns an empty file when there is nothing to combine", () => {
    expect(combineLinktCsvExports({ csvs: [] })).toBe("");
  });
});

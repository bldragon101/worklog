/**
 * @vitest-environment node
 */
import { parseLinktTripsCsv } from "@/lib/tolls/linkt-csv";
import {
  combineLinktCsvExports,
  exportLinktTrips,
  type LinktSession,
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

interface FakeResponse {
  status?: number;
  json?: unknown;
  text?: string;
}

/**
 * A signed-in session whose API calls are answered by `respond`, recording
 * each call's path in order.
 */
function fakeSession({ respond }: { respond: (path: string) => FakeResponse }) {
  const calls: string[] = [];
  const get = vi.fn(async (url: string) => {
    const { pathname, search } = new URL(url);
    const path = `${pathname.replace("/v1/accounts/111", "")}${search}`;
    calls.push(path);
    const { status = 200, json, text = "" } = respond(path);
    return {
      ok: () => status < 400,
      status: () => status,
      json: async () => json,
      text: async () => text,
    };
  });
  const session = {
    context: { request: { get } },
    bearer: "Bearer token",
    accountNumber: "111",
    agreementNumber: "222",
    close: vi.fn(),
  } as unknown as LinktSession;
  return { session, calls, get };
}

const HISTORY_HEADER =
  '"Start Date","End Date","Type","Details","LPN","Tag number","Fleet ID","Vehicle class","Amount"';

describe("exportLinktTrips", () => {
  it("waits while the export is in progress, then downloads it", async () => {
    const statuses = ["IN_PROGRESS", "IN_PROGRESS", "EXPORT_COMPLETED"];
    const { session, calls, get } = fakeSession({
      respond: (path) => {
        if (path.includes("/history/export")) return { json: { exportKey: "key1" } };
        if (path.endsWith("/checkStatus")) return { json: { status: { mnemonic: statuses.shift() } } };
        return { text: `${HISTORY_HEADER}\n` };
      },
    });

    const exports = await exportLinktTrips({ session, from: "2026-10-18", to: "2026-10-20", pollMs: 0 });

    expect(exports).toEqual([{ from: "2026-10-18", to: "2026-10-20", csv: `${HISTORY_HEADER}\n` }]);
    expect(calls).toEqual([
      "/agreements/222/history/export?data=trips&limit=1000&startDate=2026-10-18&endDate=2026-10-20&format=csv",
      "/export/key1/checkStatus",
      "/export/key1/checkStatus",
      "/export/key1/checkStatus",
      "/export/key1/download",
    ]);
    for (const [, options] of get.mock.calls as unknown as [string, { headers: Record<string, string> }][]) {
      expect(options.headers).toMatchObject({ authorization: "Bearer token", accept: "application/json" });
    }
  });

  it("starts each window's export only after the previous one has downloaded", async () => {
    const { session, calls } = fakeSession({
      respond: (path) => {
        const window = path.match(/startDate=([\d-]+)/)?.[1];
        if (window) return { json: { exportKey: `key-${window}` } };
        if (path.endsWith("/checkStatus")) return { json: { status: { mnemonic: "EXPORT_COMPLETED" } } };
        return { text: `${HISTORY_HEADER}\n${path}\n` };
      },
    });

    const exports = await exportLinktTrips({ session, from: "2026-10-18", to: "2026-10-31", pollMs: 0 });

    expect(calls.map((path) => path.replace(/\?.*/, ""))).toEqual([
      "/agreements/222/history/export",
      "/export/key-2026-10-18/checkStatus",
      "/export/key-2026-10-18/download",
      "/agreements/222/history/export",
      "/export/key-2026-10-25/checkStatus",
      "/export/key-2026-10-25/download",
    ]);
    expect(exports.map((linktExport) => linktExport.csv)).toEqual([
      `${HISTORY_HEADER}\n/export/key-2026-10-18/download\n`,
      `${HISTORY_HEADER}\n/export/key-2026-10-25/download\n`,
    ]);
  });

  it("fails when the export ends with any other status", async () => {
    const { session } = fakeSession({
      respond: (path) =>
        path.includes("/history/export")
          ? { json: { exportKey: "key1" } }
          : { json: { status: { mnemonic: "EXPORT_FAILED" } } },
    });

    await expect(
      exportLinktTrips({ session, from: "2026-10-18", to: "2026-10-18", pollMs: 0 }),
    ).rejects.toThrow("Linkt export ended with status EXPORT_FAILED");
  });

  it("gives up when the export stays in progress past the timeout", async () => {
    const { session } = fakeSession({
      respond: (path) =>
        path.includes("/history/export")
          ? { json: { exportKey: "key1" } }
          : { json: { status: { mnemonic: "IN_PROGRESS" } } },
    });

    await expect(
      exportLinktTrips({ session, from: "2026-10-18", to: "2026-10-18", pollMs: 1, timeoutMs: 5 }),
    ).rejects.toThrow("Linkt export did not finish in time");
  });

  it("fails when an API call is refused or the export reaches the row limit", async () => {
    const refused = fakeSession({ respond: () => ({ status: 401 }) });
    await expect(
      exportLinktTrips({ session: refused.session, from: "2026-10-18", to: "2026-10-18", pollMs: 0 }),
    ).rejects.toThrow("failed with status 401");

    const full = fakeSession({
      respond: (path) => {
        if (path.includes("/history/export")) return { json: { exportKey: "key1" } };
        if (path.endsWith("/checkStatus")) return { json: { status: { mnemonic: "EXPORT_COMPLETED" } } };
        return { text: [HISTORY_HEADER, ...Array.from({ length: 1000 }, () => "row")].join("\n") };
      },
    });
    await expect(
      exportLinktTrips({ session: full.session, from: "2026-10-18", to: "2026-10-18", pollMs: 0 }),
    ).rejects.toThrow("reached the 1000 trip limit");
  });
});

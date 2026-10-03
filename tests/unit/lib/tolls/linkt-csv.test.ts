/**
 * @vitest-environment node
 */
import {
  parseLinktCost,
  parseLinktDateTime,
  parseLinktTripsCsv,
} from "@/lib/tolls/linkt-csv";

const HEADER =
  "Trip Start date,Trip Details,LPN,Tag Number,Vehicle Class,Trip Cost,Trip End date";

describe("parseLinktDateTime", () => {
  it("keeps the wall-clock time as a UTC literal", () => {
    expect(parseLinktDateTime({ value: "02/10/2026 14:57" })?.toISOString()).toBe(
      "2026-10-02T14:57:00.000Z",
    );
  });

  it("rejects impossible dates and other formats", () => {
    expect(parseLinktDateTime({ value: "31/09/2026 10:00" })).toBeNull();
    expect(parseLinktDateTime({ value: "2026-10-02 14:57" })).toBeNull();
  });
});

describe("parseLinktCost", () => {
  it("turns a negative Linkt amount into a positive charge", () => {
    expect(parseLinktCost({ value: "-$20.44" })).toBe("20.44");
    expect(parseLinktCost({ value: "-$1,234.50" })).toBe("1234.50");
  });

  it("turns a positive Linkt amount into a credit", () => {
    expect(parseLinktCost({ value: "$5.00" })).toBe("-5.00");
  });

  it("rejects text that is not money", () => {
    expect(parseLinktCost({ value: "free" })).toBeNull();
  });
});

describe("parseLinktTripsCsv", () => {
  it("parses trips, skips the footer and normalises blanks", () => {
    const text = [
      HEADER,
      "02/10/2026 14:57,Punt Rd to Monash Fwy/Toorak Rd,1EA6QC,221101895540,HCV,-$20.44,02/10/2026 14:59",
      "01/09/2026 06:33,EL Thompson Rd to Dandenong Bypass,,242302021843,HCV,-$7.11,01/09/2026 06:33",
      "Total of 2 results exported",
    ].join("\n");

    const { trips, errors, totalRows } = parseLinktTripsCsv({ text });

    expect(errors).toEqual([]);
    expect(totalRows).toBe(2);
    expect(trips).toHaveLength(2);
    expect(trips[0]).toMatchObject({
      tripDetails: "Punt Rd to Monash Fwy/Toorak Rd",
      lpn: "1EA6QC",
      tagNumber: "221101895540",
      vehicleClass: "HCV",
      amount: "20.44",
    });
    expect(trips[0].tripEnd?.toISOString()).toBe("2026-10-02T14:59:00.000Z");
    expect(trips[1].lpn).toBeNull();
    expect(trips[0].fingerprint).not.toBe(trips[1].fingerprint);
  });

  it("gives the same trip the same fingerprint across exports", () => {
    const row =
      "30/09/2026 15:10,West Gate Fwy to Monash Fwy/Toorak Rd,XW36NI,,HCV,-$38.53,30/09/2026 15:44";
    const first = parseLinktTripsCsv({ text: `${HEADER}\n${row}` });
    const second = parseLinktTripsCsv({ text: `﻿${HEADER}\r\n${row}\r\n` });

    expect(second.trips[0].fingerprint).toBe(first.trips[0].fingerprint);
  });

  it("reports rows it cannot read with their line numbers", () => {
    const text = [
      HEADER,
      "bad date,Punt Rd to Monash Fwy/Toorak Rd,1EA6QC,,HCV,-$20.44,",
      "02/10/2026 14:57,Punt Rd to Monash Fwy/Toorak Rd,1EA6QC,,HCV,lots,",
    ].join("\n");

    const { trips, errors } = parseLinktTripsCsv({ text });

    expect(trips).toEqual([]);
    expect(errors).toEqual([
      'Row 2: Invalid trip start date "bad date"',
      'Row 3: Invalid trip cost "lots"',
    ]);
  });

  it("rejects a file that is not a Linkt trips export", () => {
    const { errors } = parseLinktTripsCsv({ text: "Registration,Make\nABC123,Isuzu" });

    expect(errors[0]).toMatch(/does not look like a Linkt trips export/);
  });
});

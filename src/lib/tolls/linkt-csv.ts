import { createHash } from "node:crypto";
import Papa from "papaparse";
import { normaliseRegistration } from "@/lib/tolls/toll-matching";

export const LINKT_TRIP_HEADERS = [
  "Trip Start date",
  "Trip Details",
  "LPN",
  "Tag Number",
  "Vehicle Class",
  "Trip Cost",
  "Trip End date",
] as const;

type LinktTripRow = Partial<Record<(typeof LINKT_TRIP_HEADERS)[number], string>>;

export interface ParsedTollTrip {
  fingerprint: string;
  /** Melbourne wall-clock time stored as a UTC literal, like job times */
  tripStart: Date;
  tripEnd: Date | null;
  tripDetails: string;
  lpn: string | null;
  tagNumber: string | null;
  vehicleClass: string | null;
  /** Amount charged as a decimal string; a credit is negative */
  amount: string;
}

export interface ParsedLinktTrips {
  trips: ParsedTollTrip[];
  errors: string[];
  totalRows: number;
}

const DATE_TIME_PATTERN =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const COST_PATTERN = /^(-)?\$?(-)?\s*([\d,]*\d(?:\.\d{1,2})?)$/;
const FOOTER_PATTERN = /^Total of \d+ results? exported$/i;

/**
 * Parse a Linkt "dd/MM/yyyy HH:mm" timestamp into a UTC-literal Date, so
 * 14:57 in the export is stored and displayed as 14:57.
 */
export function parseLinktDateTime({ value }: { value: string }): Date | null {
  const match = value.trim().match(DATE_TIME_PATTERN);
  if (!match) return null;

  const [, day, month, year, hour, minute, second = "0"] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) {
    return null;
  }
  return date;
}

/**
 * Parse a Linkt trip cost into the amount charged. Linkt lists charges as
 * negative ("-$20.44" is a charge of 20.44), so the sign is flipped and a
 * credit comes out negative.
 */
export function parseLinktCost({ value }: { value: string }): string | null {
  const match = value.trim().match(COST_PATTERN);
  if (!match) return null;

  const [, leadingMinus, innerMinus, digits] = match;
  const cents = Math.round(Number(digits.replace(/,/g, "")) * 100);
  if (!Number.isFinite(cents)) return null;

  const isNegativeInFile = Boolean(leadingMinus || innerMinus);
  const charged = isNegativeInFile ? cents : -cents;
  const sign = charged < 0 ? "-" : "";
  const absolute = Math.abs(charged);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function blankToNull({ value }: { value: string | undefined }): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function buildFingerprint({ trip }: { trip: Omit<ParsedTollTrip, "fingerprint"> }) {
  return createHash("sha256")
    .update(
      [
        trip.tripStart.toISOString(),
        trip.tripEnd?.toISOString() ?? "",
        trip.tripDetails,
        trip.lpn ?? "",
        trip.tagNumber ?? "",
        trip.vehicleClass ?? "",
        trip.amount,
      ].join("|"),
    )
    .digest("hex");
}

/**
 * Parse a Linkt trip history CSV export into toll trips. Rows that cannot be
 * parsed are reported in `errors` with their line number.
 */
export function parseLinktTripsCsv({ text }: { text: string }): ParsedLinktTrips {
  const result = Papa.parse<LinktTripRow>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const headers = result.meta.fields ?? [];
  const missingHeaders = LINKT_TRIP_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      trips: [],
      errors: [
        `This does not look like a Linkt trips export. Missing columns: ${missingHeaders.join(", ")}`,
      ],
      totalRows: 0,
    };
  }

  const trips: ParsedTollTrip[] = [];
  const errors: string[] = [];
  let totalRows = 0;

  for (const [index, row] of result.data.entries()) {
    const line = index + 2;
    const startValue = row["Trip Start date"]?.trim() ?? "";
    if (FOOTER_PATTERN.test(startValue)) continue;
    totalRows += 1;

    const tripStart = parseLinktDateTime({ value: startValue });
    if (!tripStart) {
      errors.push(`Row ${line}: Invalid trip start date "${startValue}"`);
      continue;
    }

    const endValue = row["Trip End date"]?.trim() ?? "";
    const tripEnd = endValue ? parseLinktDateTime({ value: endValue }) : null;
    if (endValue && !tripEnd) {
      errors.push(`Row ${line}: Invalid trip end date "${endValue}"`);
      continue;
    }

    const costValue = row["Trip Cost"]?.trim() ?? "";
    const amount = parseLinktCost({ value: costValue });
    if (amount === null) {
      errors.push(`Row ${line}: Invalid trip cost "${costValue}"`);
      continue;
    }

    const tripDetails = row["Trip Details"]?.trim() ?? "";
    if (!tripDetails) {
      errors.push(`Row ${line}: Missing trip details`);
      continue;
    }

    const lpn = blankToNull({ value: row.LPN });
    const trip = {
      tripStart,
      tripEnd,
      tripDetails,
      lpn: lpn ? normaliseRegistration({ registration: lpn }) : null,
      tagNumber: blankToNull({ value: row["Tag Number"] }),
      vehicleClass: blankToNull({ value: row["Vehicle Class"] }),
      amount,
    };
    trips.push({ ...trip, fingerprint: buildFingerprint({ trip }) });
  }

  return { trips, errors, totalRows };
}

import { z } from "zod";

// Matches YYYY-MM-DD with optional THH:MM:SS (and optional trailing content like .000Z)
const isoDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/;
export const isoDateString = z
  .string()
  .regex(
    isoDatePattern,
    "Expected ISO date format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)",
  );

/**
 * Parse an ISO date string (or Date object) into a Date using explicit UTC
 * construction.  Never falls back to `new Date(string)` which would apply
 * local-timezone conversions.
 */
export function parseIsoToUtcDate({
  isoString,
}: {
  isoString: string | Date;
}): Date {
  const str =
    typeof isoString === "string" ? isoString : isoString.toISOString();
  const match = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (match) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
    return new Date(
      Date.UTC(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10),
      ),
    );
  }
  throw new Error(`Invalid date format: ${str}`);
}

// Shared field schemas for batch operations
export const batchCreateItemSchema = z.object({
  date: isoDateString,
  driver: z.string(),
  customer: z.string(),
  billTo: z.string(),
  truckType: z.string(),
  registration: z.string(),
  pickup: z.string(),
  dropoff: z.string().optional().nullable(),
  runsheet: z.boolean().optional().nullable(),
  invoiced: z.boolean().optional().nullable(),
  chargedHours: z.number().optional().nullable(),
  driverCharge: z.number().optional().nullable(),
  startTime: isoDateString.optional().nullable(),
  finishTime: isoDateString.optional().nullable(),
  comments: z.string().optional().nullable(),
  jobReference: z.string().optional().nullable(),
  eastlink: z.number().int().optional().nullable(),
  citylink: z.number().int().optional().nullable(),
});

export const batchUpdateItemSchema = z.object({
  id: z.number(),
  data: z.object({
    date: isoDateString.optional(),
    driver: z.string().optional(),
    customer: z.string().optional(),
    billTo: z.string().optional(),
    truckType: z.string().optional(),
    registration: z.string().optional(),
    pickup: z.string().optional(),
    dropoff: z.string().optional().nullable(),
    runsheet: z.boolean().optional().nullable(),
    invoiced: z.boolean().optional().nullable(),
    chargedHours: z.number().optional().nullable(),
    driverCharge: z.number().optional().nullable(),
    startTime: isoDateString.optional().nullable(),
    finishTime: isoDateString.optional().nullable(),
    comments: z.string().optional().nullable(),
    jobReference: z.string().optional().nullable(),
    eastlink: z.number().int().optional().nullable(),
    citylink: z.number().int().optional().nullable(),
  }),
});

export const batchOperationSchema = z.object({
  creates: z.array(batchCreateItemSchema).max(200).default([]),
  updates: z.array(batchUpdateItemSchema).max(200).default([]),
  deletes: z.array(z.number()).max(200).default([]),
});

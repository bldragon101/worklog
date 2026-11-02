import { z } from "zod";
import {
  addDaysToIsoDate,
  getWeekEndingSundayIsoDate,
} from "@/lib/utils/jobs-report-dates";
import { isIsoDate } from "@/lib/customer-invoices/grouping";
import { ApiError } from "@/lib/api-error";

/** Largest value of a Postgres integer column */
const MAX_INT_ID = 2_147_483_647;

export const MAX_INVOICE_JOBS = 500;
export const MAX_REFERENCE_LENGTH = 100;
export const MAX_NOTES_LENGTH = 1000;
export const MAX_WAIVED_BREAK_DEDUCTIONS = 50;
export const MAX_BREAK_KEY_LENGTH = 100;

function unique<T>({ values }: { values: T[] }): T[] {
  return [...new Set(values)];
}

/**
 * Whether a YYYY-MM-DD string is a real calendar date. The date helpers return
 * an invalid date unchanged, so a real date is one that moves when a day is
 * added.
 */
function isCalendarDate({ value }: { value: string }): boolean {
  return isIsoDate({ value }) && addDaysToIsoDate({ isoDate: value, days: 1 }) !== value;
}

/** A week ending: a real YYYY-MM-DD date that is a Sunday */
export const weekEndingSchema = z
  .string({ error: "weekEnding is required" })
  .refine((value) => isCalendarDate({ value }), {
    error: "weekEnding must be a date in YYYY-MM-DD format",
  })
  .refine((value) => getWeekEndingSundayIsoDate({ isoDate: value }) === value, {
    error: "weekEnding must be a Sunday",
  });

export const customerInvoicesQuerySchema = z.object({
  weekEnding: weekEndingSchema,
});

const jobIdsSchema = z
  .array(z.number().int().positive().max(MAX_INT_ID), {
    error: "jobIds must be a list of job IDs",
  })
  .min(1, { error: "Select at least one job" })
  .max(MAX_INVOICE_JOBS, {
    error: `An invoice can have at most ${MAX_INVOICE_JOBS} jobs`,
  })
  .transform((values) => unique({ values }));

const referenceSchema = z
  .string()
  .trim()
  .min(1, { error: "Reference cannot be empty" })
  .max(MAX_REFERENCE_LENGTH, {
    error: `Reference must be at most ${MAX_REFERENCE_LENGTH} characters`,
  });

/** POST /api/customer-invoices */
export const createCustomerInvoiceSchema = z.object({
  jobIds: jobIdsSchema,
  reference: referenceSchema.optional(),
});

export type CreateCustomerInvoiceInput = z.output<typeof createCustomerInvoiceSchema>;

/** PATCH /api/customer-invoices/[id] */
export const updateCustomerInvoiceSchema = z
  .object({
    reference: referenceSchema.optional(),
    notes: z
      .string()
      .max(MAX_NOTES_LENGTH, {
        error: `Notes must be at most ${MAX_NOTES_LENGTH} characters`,
      })
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value)),
    waivedBreakDeductions: z
      .array(
        z.string().max(MAX_BREAK_KEY_LENGTH, {
          error: `Break deduction keys must be at most ${MAX_BREAK_KEY_LENGTH} characters`,
        }),
      )
      .max(MAX_WAIVED_BREAK_DEDUCTIONS, {
        error: `At most ${MAX_WAIVED_BREAK_DEDUCTIONS} break deductions can be waived`,
      })
      .transform((values) => unique({ values }))
      .optional(),
  })
  .refine(
    (data) =>
      data.reference !== undefined ||
      data.notes !== undefined ||
      data.waivedBreakDeductions !== undefined,
    { error: "Provide at least one field to update" },
  );

export type UpdateCustomerInvoiceInput = z.output<typeof updateCustomerInvoiceSchema>;

/** POST /api/customer-invoices/[id]/remove-jobs */
export const removeCustomerInvoiceJobsSchema = z.object({
  jobIds: jobIdsSchema,
});

/**
 * Reads a JSON request body and parses it with the schema. Malformed JSON is
 * a 400; a schema failure throws a ZodError for the route to answer with 400.
 */
export async function parseJsonBody<S extends z.ZodType>({
  request,
  schema,
}: {
  request: Request;
  schema: S;
}): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError({ status: 400, message: "Invalid JSON body" });
  }
  return schema.parse(body);
}

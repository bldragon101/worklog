import { z } from "zod";
import { SYSTEM_LINE_CUSTOMERS } from "@/lib/rcti-line-builder";

const reservedCustomers = new Set(
  Array.from(SYSTEM_LINE_CUSTOMERS, (customer) => customer.toLowerCase()),
);

export const RESERVED_MANUAL_LINE_CUSTOMER_MESSAGE = `${Array.from(
  SYSTEM_LINE_CUSTOMERS,
).join(
  ", ",
)} are used for lines the RCTI calculates itself and are replaced on refresh. Use another name, such as "Break adjustment".`;

const finiteNumber = z.union([
  z.number().finite(),
  z
    .string()
    .trim()
    .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i)
    .transform(Number)
    .pipe(z.number().finite()),
]);

const nonnegativeNumber = finiteNumber.pipe(z.number().nonnegative());
// Negative hours make a credit line, such as a break deduction
const nonzeroHours = finiteNumber.pipe(
  z.number().refine((value) => value !== 0),
);
const travelHours = z.union([
  z.literal("").transform(() => 0),
  nonnegativeNumber,
]);
const jobDate = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const manualRctiLineRequestSchema = z.object({
  manualLine: z.object({
    jobDate,
    customer: z
      .string()
      .trim()
      .min(1)
      .refine((customer) => !reservedCustomers.has(customer.toLowerCase()), {
        message: RESERVED_MANUAL_LINE_CUSTOMER_MESSAGE,
      }),
    truckType: z.string().trim().min(1),
    description: z.string().trim().nullish(),
    chargedHours: nonzeroHours,
    travelTimeHours: travelHours.default(0),
    ratePerHour: nonnegativeNumber,
  }),
});

const editedRctiLinesSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    chargedHours: nonzeroHours.optional(),
    travelTimeHours: travelHours.optional(),
    ratePerHour: finiteNumber.pipe(z.number().positive()).optional(),
    jobDate: jobDate.optional(),
    customer: z.string().trim().min(1).optional(),
    truckType: z.string().trim().min(1).optional(),
    description: z.string().optional(),
  }),
);

export function validateRctiLineEdits({
  editedLines,
}: {
  editedLines: ReadonlyMap<
    number,
    {
      chargedHours?: number | string;
      travelTimeHours?: number | string;
      ratePerHour?: number | string;
      jobDate?: string;
      customer?: string;
      truckType?: string;
      description?: string;
    }
  >;
}) {
  return editedRctiLinesSchema.safeParse(
    Array.from(editedLines, ([id, data]) => ({ ...data, id })),
  );
}

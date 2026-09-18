import { z } from "zod";

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
const travelHours = z.union([
  z.literal("").transform(() => 0),
  nonnegativeNumber,
]);
const jobDate = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const manualRctiLineRequestSchema = z.object({
  manualLine: z.object({
    jobDate,
    customer: z.string().trim().min(1),
    truckType: z.string().trim().min(1),
    description: z.string().trim().nullish(),
    chargedHours: nonnegativeNumber,
    travelTimeHours: travelHours.default(0),
    ratePerHour: nonnegativeNumber,
  }),
});

const editedRctiLinesSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    chargedHours: finiteNumber
      .pipe(z.number().refine((value) => value !== 0))
      .optional(),
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

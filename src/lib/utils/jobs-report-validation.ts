import { z } from "zod";

const emptyToNull = (val: unknown) =>
  val === "" || val === undefined ? null : val;

const optionalTime = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
    .nullable(),
);

const hoursNumber = z
  .union([z.number(), z.string().trim().min(1).transform(Number)])
  .pipe(z.number().finite().nonnegative());

const optionalHours = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  hoursNumber.nullable().optional().default(null),
);

const optionalDescription = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  z.string().trim().max(500).nullable().optional().default(null),
);

/**
 * A manual line on a jobs report. `driverCharge` is the driver hours total;
 * leave it empty to pay job hours plus travel time.
 */
export const manualJobsReportLineSchema = z.object({
  jobDate: z.iso.date(),
  customer: z.string().trim().min(1),
  truckType: z.string().trim().min(1),
  description: optionalDescription,
  startTime: optionalTime,
  finishTime: optionalTime,
  chargedHours: hoursNumber,
  travelTimeHours: optionalHours,
  driverCharge: optionalHours,
});

export const manualJobsReportLineRequestSchema = z.object({
  manualLine: manualJobsReportLineSchema,
});

export type ManualJobsReportLine = z.infer<typeof manualJobsReportLineSchema>;

/**
 * Converts a validated manual line into the columns stored on the line.
 */
export function toManualJobsReportLineData({
  line,
}: {
  line: ManualJobsReportLine;
}) {
  return {
    jobDate: new Date(`${line.jobDate}T00:00:00.000Z`),
    customer: line.customer,
    truckType: line.truckType,
    description: line.description,
    startTime: line.startTime,
    finishTime: line.finishTime,
    chargedHours: line.chargedHours,
    travelTimeHours: line.travelTimeHours,
    driverCharge: line.driverCharge,
  };
}

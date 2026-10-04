import type { Prisma } from "@/generated/prisma/client";

/**
 * Job fields that feed an RCTI line. While a job is on a finalised or paid
 * RCTI these cannot change, so the jobs table and what the driver was paid
 * stay in step. Other fields (invoiced, runsheet, attachments, comments and
 * so on) stay editable.
 */
export const RCTI_LOCKED_JOB_FIELDS = [
  "date",
  "driver",
  "customer",
  "registration",
  "truckType",
  "chargedHours",
  "travelTimeHours",
  "driverCharge",
  "deductionHours",
  "hideDeduction",
  "eastlink",
  "citylink",
  "startTime",
  "finishTime",
] as const;

type LockedJobField = (typeof RCTI_LOCKED_JOB_FIELDS)[number];

const FIELD_LABELS: Record<LockedJobField, string> = {
  date: "date",
  driver: "driver",
  customer: "customer",
  registration: "truck",
  truckType: "truck type",
  chargedHours: "charged hours",
  travelTimeHours: "travel hours",
  driverCharge: "driver hours",
  deductionHours: "deduction hours",
  hideDeduction: "hidden deduction",
  eastlink: "Eastlink tolls",
  citylink: "CityLink tolls",
  startTime: "start time",
  finishTime: "finish time",
};

const DATE_FIELDS = new Set<LockedJobField>(["date", "startTime", "finishTime"]);

// Blank and zero mean the same thing for these: no travel, no deduction, no
// tolls. Charged hours and driver hours keep zero as its own value.
const ZERO_IS_BLANK_FIELDS = new Set<LockedJobField>([
  "travelTimeHours",
  "deductionHours",
  "eastlink",
  "citylink",
]);

type JobValues = Partial<Record<LockedJobField, unknown>>;

function normaliseValue({
  field,
  value,
}: {
  field: LockedJobField;
  value: unknown;
}) {
  if (value === undefined || value === null || value === "") return null;
  if (DATE_FIELDS.has(field)) {
    const time = new Date(value as string | Date).getTime();
    return Number.isNaN(time) ? String(value) : time;
  }
  if (typeof value === "string") return value.trim().toUpperCase();
  if (typeof value === "number" || typeof value === "object") {
    const number = Number(value);
    if (ZERO_IS_BLANK_FIELDS.has(field) && number === 0) return null;
    return number;
  }
  return value;
}

/**
 * Locked fields that `update` would change on `existing`. Fields left out of
 * the update are unchanged.
 */
export function getChangedLockedFields({
  existing,
  update,
}: {
  existing: JobValues;
  update: JobValues;
}) {
  return RCTI_LOCKED_JOB_FIELDS.filter(
    (field) =>
      field in update &&
      update[field] !== undefined &&
      normaliseValue({ field, value: existing[field] }) !==
        normaliseValue({ field, value: update[field] }),
  );
}

/**
 * The finalised or paid RCTI each of the given jobs is on, if any.
 */
export async function getLockingRctis({
  db,
  jobIds,
}: {
  db: Prisma.TransactionClient;
  jobIds: number[];
}) {
  const locking = new Map<number, { invoiceNumber: string; status: string }>();
  if (jobIds.length === 0) return locking;

  const lines = await db.rctiLine.findMany({
    where: {
      jobId: { in: jobIds },
      rcti: { status: { in: ["finalised", "paid"] } },
    },
    select: {
      jobId: true,
      rcti: { select: { invoiceNumber: true, status: true } },
    },
  });
  for (const line of lines) {
    if (line.jobId !== null) {
      locking.set(line.jobId, line.rcti);
    }
  }
  return locking;
}

/**
 * Message explaining why a job on a finalised or paid RCTI cannot be changed.
 */
export function getLockedJobMessage({
  jobId,
  rcti,
  fields,
}: {
  jobId: number;
  rcti: { invoiceNumber: string; status: string };
  fields?: LockedJobField[];
}) {
  const action = fields
    ? `changing its ${fields.map((field) => FIELD_LABELS[field]).join(", ")}`
    : "deleting it";
  const release =
    rcti.status === "paid"
      ? "Revert the RCTI to draft"
      : "Unfinalise the RCTI";
  return `Job ${jobId} is on ${rcti.status} RCTI ${rcti.invoiceNumber}. ${release} before ${action}.`;
}

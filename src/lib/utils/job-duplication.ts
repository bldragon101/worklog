import { Job } from "@/lib/types";

/**
 * Fields that should be excluded when duplicating a job
 * These are system-generated fields or fields that should be unique per job
 */
export const SYSTEM_FIELDS_TO_EXCLUDE = [
  "id",
  "date",
  "createdAt",
  "updatedAt",
  "attachmentRunsheet",
  "attachmentDocket",
  "attachmentDeliveryPhotos",
] as const;

/**
 * Required fields that must be present for a job to be duplicated
 * These fields are essential for creating a valid new job
 */
export const REQUIRED_DUPLICATION_FIELDS = [
  "customer",
  "driver",
  "truckType",
  "registration",
] as const;

/**
 * Type for system fields that should be excluded
 */
export type SystemField = (typeof SYSTEM_FIELDS_TO_EXCLUDE)[number];

/**
 * Type for required duplication fields
 */
export type RequiredField = (typeof REQUIRED_DUPLICATION_FIELDS)[number];

/**
 * Type for a job object without system fields
 */
export type JobWithoutSystemFields<T = Job> = Omit<T, SystemField>;

/**
 * Validates if a job has all required fields for duplication
 *
 * @param job - The job to validate
 * @returns Object containing validation result and missing fields
 * @returns {boolean} isValid - Whether the job can be duplicated
 * @returns {string[]} missingFields - Array of field names that are missing or empty
 *
 * @example
 * ```typescript
 * const result = validateJobForDuplication(job);
 * if (!result.isValid) {
 *   console.error('Missing fields:', result.missingFields);
 * }
 * ```
 */
export function validateJobForDuplication(job: Job): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of REQUIRED_DUPLICATION_FIELDS) {
    if (!job[field]) {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Creates a duplicate of a job, excluding system fields and resetting specific fields
 *
 * @param job - The original job to duplicate
 * @returns A new partial job object with duplicated and reset fields
 *
 * @remarks
 * This function:
 * - Copies core business fields (driver, customer, etc.)
 * - Resets status fields (runsheet, invoiced)
 * - Clears time and charge fields
 * - Clears job reference and comments (job-specific information)
 * - Excludes system fields (id, dates, attachments)
 *
 * @example
 * ```typescript
 * const duplicatedJob = createJobDuplicate(originalJob);
 * // duplicatedJob will have same driver, customer, etc.
 * // but runsheet=false, invoiced=false, no id, date, comments or jobReference
 * ```
 */
export function createJobDuplicate(job: Job): Partial<Job> {
  const duplicatedJob: Partial<Job> = {
    driver: job.driver || "",
    customer: job.customer || "",
    billTo: job.billTo || "",
    registration: job.registration || "",
    truckType: job.truckType || "",
    pickup: job.pickup || "",
    dropoff: job.dropoff || "",
    comments: "", // Clear comments - job-specific information
    jobReference: "", // Clear job reference - job-specific identifier
    runsheet: false,
    invoiced: false,
    chargedHours: null,
    driverCharge: null,
    startTime: null,
    finishTime: null,
    eastlink: null,
    citylink: null,
  };

  return duplicatedJob;
}

/**
 * Type guard to check if a key is a system field
 */
export function isSystemField(key: string): key is SystemField {
  return (SYSTEM_FIELDS_TO_EXCLUDE as readonly string[]).includes(key);
}

/**
 * Removes system fields from a job object
 *
 * @param job - The job object to remove system fields from
 * @returns A new object with system fields removed
 *
 * @remarks
 * This function returns a new object without system fields.
 * Use this after creating a job duplicate to ensure no system fields are present.
 *
 * @example
 * ```typescript
 * const jobCopy = { ...originalJob };
 * const cleanJob = removeSystemFields(jobCopy);
 * // cleanJob no longer has id, createdAt, updatedAt, etc.
 * ```
 */
export function removeSystemFields<T extends Record<string, unknown>>(
  job: T,
): Omit<T, SystemField> {
  // Create a new object without system fields
  const cleanJob: Record<string, unknown> = {};

  const systemFieldsSet = new Set<string>([
    "id",
    "date",
    "createdAt",
    "updatedAt",
    "attachmentRunsheet",
    "attachmentDocket",
    "attachmentDeliveryPhotos",
  ]);

  for (const key in job) {
    if (!systemFieldsSet.has(key)) {
      cleanJob[key] = job[key];
    }
  }

  return cleanJob as Omit<T, SystemField>;
}

/**
 * Formats missing field names for user-friendly display
 *
 * @param fields - Array of field names to format
 * @returns A formatted string with proper grammar (e.g., "field1, field2 and field3")
 *
 * @example
 * ```typescript
 * formatMissingFields(['driver', 'customer']) // "driver and customer"
 * formatMissingFields(['a', 'b', 'c']) // "a, b and c"
 * formatMissingFields(['field']) // "field"
 * formatMissingFields([]) // ""
 * ```
 */
export function formatMissingFields(fields: string[]): string {
  if (fields.length === 0) return "";
  if (fields.length === 1) return fields[0];

  const lastField = fields[fields.length - 1];
  const otherFields = fields.slice(0, -1);

  return `${otherFields.join(", ")} and ${lastField}`;
}

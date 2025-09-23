import { Job } from '@/lib/types';

// Fields that should be excluded when duplicating a job
export const SYSTEM_FIELDS_TO_EXCLUDE = [
  'id',
  'date',
  'createdAt',
  'updatedAt',
  'attachmentRunsheet',
  'attachmentDocket',
  'attachmentDeliveryPhotos'
] as const;

// Required fields for job duplication
export const REQUIRED_DUPLICATION_FIELDS = ['customer', 'driver', 'truckType', 'registration'] as const;

/**
 * Validates if a job has all required fields for duplication
 */
export function validateJobForDuplication(job: Job): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of REQUIRED_DUPLICATION_FIELDS) {
    if (!job[field]) {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Creates a duplicate of a job, excluding system fields and resetting specific fields
 */
export function createJobDuplicate(job: Job): Partial<Job> {
  const duplicatedJob: Partial<Job> = {
    driver: job.driver || '',
    customer: job.customer || '',
    billTo: job.billTo || '',
    registration: job.registration || '',
    truckType: job.truckType || '',
    pickup: job.pickup || '',
    dropoff: job.dropoff || '',
    comments: job.comments || '',
    jobReference: job.jobReference || '',
    runsheet: false,
    invoiced: false,
    chargedHours: null,
    driverCharge: null,
    startTime: null,
    finishTime: null,
    eastlink: null,
    citylink: null
  };

  return duplicatedJob;
}

/**
 * Removes system fields from a job object
 */
export function removeSystemFields(job: Record<string, unknown>): void {
  for (const field of SYSTEM_FIELDS_TO_EXCLUDE) {
    delete job[field];
  }
}

/**
 * Formats missing field names for display
 */
export function formatMissingFields(fields: string[]): string {
  if (fields.length === 0) return '';
  if (fields.length === 1) return fields[0];

  const lastField = fields[fields.length - 1];
  const otherFields = fields.slice(0, -1);

  return `${otherFields.join(', ')} and ${lastField}`;
}

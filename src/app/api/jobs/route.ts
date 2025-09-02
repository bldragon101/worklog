import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { jobSchema, jobUpdateSchema } from '@/lib/validation';
import { z } from 'zod';

type JobCreateData = z.infer<typeof jobSchema>;

// Create CRUD handlers for jobs
const jobHandlers = createCrudHandlers({
  model: prisma.jobs,
  createSchema: jobSchema,
  updateSchema: jobUpdateSchema,
  resourceType: 'job', // SECURITY: Required for payload validation
  tableName: 'Jobs', // For activity logging
  listOrderBy: { date: 'asc' },
  createTransform: (data: JobCreateData) => ({
    date: new Date(data.date),
    driver: data.driver,
    customer: data.customer,
    billTo: data.billTo,
    truckType: data.truckType,
    registration: data.registration,
    pickup: data.pickup || '',
    dropoff: (typeof data.dropoff === 'string' && data.dropoff.trim() !== '') ? data.dropoff.trim() : null,
    runsheet: data.runsheet,
    invoiced: data.invoiced,
    chargedHours: data.chargedHours,
    driverCharge: data.driverCharge,
    startTime: data.startTime ? new Date(data.startTime) : null,
    finishTime: data.finishTime ? new Date(data.finishTime) : null,
    comments: (typeof data.comments === 'string' && data.comments.trim() !== '') ? data.comments.trim() : null,
    jobReference: (typeof data.jobReference === 'string' && data.jobReference.trim() !== '') ? data.jobReference.trim() : null,
    eastlink: data.eastlink,
    citylink: data.citylink,
  })
});

export async function GET(request: NextRequest) {
  return jobHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return jobHandlers.create(request);
}

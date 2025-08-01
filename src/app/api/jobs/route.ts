import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { jobSchema } from '@/lib/validation';
import { z } from 'zod';

type JobCreateData = z.infer<typeof jobSchema>;

// Create CRUD handlers for jobs
const jobHandlers = createCrudHandlers({
  model: prisma.jobs,
  createSchema: jobSchema,
  updateSchema: jobSchema.partial(),
  listOrderBy: { date: 'desc' },
  createTransform: (data: JobCreateData) => ({
    date: new Date(data.date),
    driver: data.driver,
    customer: data.customer,
    billTo: data.billTo,
    truckType: data.truckType,
    registration: data.registration,
    pickup: data.pickup || '',
    dropoff: data.dropoff || '',
    runsheet: data.runsheet,
    invoiced: data.invoiced,
    chargedHours: data.chargedHours,
    driverCharge: data.driverCharge,
    comments: data.comments || null,
  })
});

export async function GET(request: NextRequest) {
  return jobHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return jobHandlers.create(request);
}

import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { jobSchema } from '@/lib/validation';
import { z } from 'zod';

type JobUpdateData = Partial<z.infer<typeof jobSchema>>;

// Create CRUD handlers for jobs
const jobHandlers = createCrudHandlers({
  model: prisma.jobs,
  createSchema: jobSchema,
  updateSchema: jobSchema.partial(),
  updateTransform: (data: JobUpdateData) => {
    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.driver !== undefined) updateData.driver = data.driver;
    if (data.customer !== undefined) updateData.customer = data.customer;
    if (data.billTo !== undefined) updateData.billTo = data.billTo;
    if (data.truckType !== undefined) updateData.truckType = data.truckType;
    if (data.registration !== undefined) updateData.registration = data.registration;
    if (data.pickup !== undefined) updateData.pickup = data.pickup;
    if (data.dropoff !== undefined) updateData.dropoff = data.dropoff;
    if (data.runsheet !== undefined) updateData.runsheet = data.runsheet;
    if (data.invoiced !== undefined) updateData.invoiced = data.invoiced;
    if (data.chargedHours !== undefined) updateData.chargedHours = data.chargedHours;
    if (data.driverCharge !== undefined) updateData.driverCharge = data.driverCharge;
    if (data.comments !== undefined) updateData.comments = data.comments;
    return updateData;
  }
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return jobHandlers.getById(req, params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return jobHandlers.updateById(req, params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return jobHandlers.deleteById(req, params);
}

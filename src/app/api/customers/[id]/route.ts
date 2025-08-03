import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { customerSchema } from '@/lib/validation';
import { z } from 'zod';

type CustomerUpdateData = Partial<z.infer<typeof customerSchema>>;

// Create CRUD handlers for customers
const customerHandlers = createCrudHandlers({
  model: prisma.customer,
  createSchema: customerSchema,
  updateSchema: customerSchema.partial(),
  resourceType: 'customer', // SECURITY: Required for payload validation
  updateTransform: (data: CustomerUpdateData) => ({
    customer: data.customer,
    billTo: data.billTo,
    contact: data.contact,
    tray: data.tray || null,
    crane: data.crane || null,
    semi: data.semi || null,
    semiCrane: data.semiCrane || null,
    fuelLevy: data.fuelLevy || null,
    tolls: data.tolls || false,
    comments: data.comments || null,
  })
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return customerHandlers.updateById(request, params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return customerHandlers.deleteById(request, params);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return customerHandlers.getById(request, params);
}

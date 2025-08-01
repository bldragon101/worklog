import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { customerSchema } from '@/lib/validation';
import { z } from 'zod';

type CustomerCreateData = z.infer<typeof customerSchema>;

// Create CRUD handlers for customers
const customerHandlers = createCrudHandlers({
  model: prisma.customer,
  createSchema: customerSchema,
  updateSchema: customerSchema.partial(),
  listOrderBy: { createdAt: 'desc' },
  createTransform: (data: CustomerCreateData) => ({
    customer: data.customer,
    billTo: data.billTo,
    contact: data.contact || '',
    tray: data.tray || null,
    crane: data.crane || null,
    semi: data.semi || null,
    semiCrane: data.semiCrane || null,
    fuelLevy: data.fuelLevy || null,
    tolls: data.tolls || false,
    comments: data.comments || null,
  })
});

export async function GET(request: NextRequest) {
  return customerHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return customerHandlers.create(request);
}

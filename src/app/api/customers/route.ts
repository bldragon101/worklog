import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { customerCreateSchema, customerSchema } from '@/lib/validation';
import { z } from 'zod';

type CustomerCreateData = z.infer<typeof customerCreateSchema>;

// Create CRUD handlers for customers
const customerHandlers = createCrudHandlers({
  model: prisma.customer,
  createSchema: customerCreateSchema,
  updateSchema: customerSchema.partial(),
  resourceType: 'customer', // SECURITY: Required for payload validation
  tableName: 'Customer', // For activity logging
  listOrderBy: { createdAt: 'desc' },
  createTransform: (data: CustomerCreateData) => ({
    customer: data.customer,
    billTo: data.billTo,
    contact: data.contact || '',
    tray: data.tray,
    crane: data.crane,
    semi: data.semi,
    semiCrane: data.semiCrane,
    fuelLevy: data.fuelLevy,
    tolls: data.tolls,
    breakDeduction: data.breakDeduction || null,
    comments: data.comments || null,
  })
});

export async function GET(request: NextRequest) {
  return customerHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return customerHandlers.create(request);
}

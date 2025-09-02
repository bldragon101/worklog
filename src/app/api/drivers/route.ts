import { NextRequest } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { driverSchema } from '@/lib/validation';
import { z } from 'zod';

type DriverCreateData = z.infer<typeof driverSchema>;

// Create CRUD handlers for drivers
const driverHandlers = createCrudHandlers({
  model: prisma.driver,
  createSchema: driverSchema,
  updateSchema: driverSchema.partial(),
  resourceType: 'driver', // SECURITY: Required for payload validation
  tableName: 'Driver', // For activity logging
  listOrderBy: { createdAt: 'desc' },
  createTransform: (data: DriverCreateData) => ({
    driver: data.driver,
    truck: data.truck,
    tray: data.tray || null,
    crane: data.crane || null,
    semi: data.semi || null,
    semiCrane: data.semiCrane || null,
    breaks: data.breaks || null,
    type: data.type || 'Employee',
    // Only set tolls and fuel levy for subcontractors
    tolls: data.type === 'Subcontractor' ? (data.tolls || false) : false,
    fuelLevy: data.type === 'Subcontractor' ? (data.fuelLevy || null) : null,
  })
});

export async function GET(request: NextRequest) {
  return driverHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return driverHandlers.create(request);
}
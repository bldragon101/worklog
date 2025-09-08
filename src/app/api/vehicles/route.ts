import { NextRequest, NextResponse } from 'next/server';
import { createCrudHandlers, prisma } from '@/lib/api-helpers';
import { vehicleSchema } from '@/lib/validation';
import { z } from 'zod';

type VehicleCreateData = z.infer<typeof vehicleSchema>;

// Create CRUD handlers for vehicles
const vehicleHandlers = createCrudHandlers({
  model: prisma.vehicle,
  createSchema: vehicleSchema,
  updateSchema: vehicleSchema.partial(),
  resourceType: 'vehicle', // SECURITY: Required for payload validation
  tableName: 'Vehicle', // For activity logging
  listOrderBy: { expiryDate: 'asc' },
  createTransform: (data: VehicleCreateData) => ({
    registration: data.registration,
    expiryDate: new Date(data.expiryDate),
    make: data.make,
    model: data.model,
    yearOfManufacture: data.yearOfManufacture,
    type: data.type,
    carryingCapacity: data.carryingCapacity || null,
    trayLength: data.trayLength || null,
    craneReach: data.craneReach || null,
    craneType: data.craneType || null,
    craneCapacity: data.craneCapacity || null,
  }),
  beforeCreate: async (data: VehicleCreateData) => {
    // Check if registration already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registration: data.registration }
    });
    
    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle with this registration already exists' }, 
        { status: 409 }
      );
    }
    return null;
  }
});

export async function GET(request: NextRequest) {
  return vehicleHandlers.list(request);
}

export async function POST(request: NextRequest) {
  return vehicleHandlers.create(request);
}
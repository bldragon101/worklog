import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { vehicleUpdateSchema, validateRequestBody, idParamSchema } from '@/lib/validation';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const prisma = new PrismaClient();
const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get the id from the Promise
    const { id } = await params;

    // Validate ID parameter
    const validationResult = idParamSchema.safeParse({ id });
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json(vehicle, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get the id from the Promise
    const { id } = await params;

    // Validate ID parameter
    const validationResult = idParamSchema.safeParse({ id });
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 });
    }

    // Validate request body
    const bodyValidationResult = await validateRequestBody(request, vehicleUpdateSchema);
    if (!bodyValidationResult.success) {
      return NextResponse.json({ error: bodyValidationResult.error }, { status: 400 });
    }

    const data = bodyValidationResult.data;
    const vehicleId = parseInt(id);

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // If registration is being updated, check if it already exists for another vehicle
    if (data.registration && data.registration !== existingVehicle.registration) {
      const vehicleWithSameRegistration = await prisma.vehicle.findUnique({
        where: { registration: data.registration }
      });
      
      if (vehicleWithSameRegistration) {
        return NextResponse.json(
          { error: 'Vehicle with this registration already exists' }, 
          { status: 409 }
        );
      }
    }

    // Create properly typed update object
    type VehicleUpdateData = Partial<{
      registration: string;
      expiryDate: Date;
      make: string;
      model: string;
      yearOfManufacture: number;
      type: string;
      carryingCapacity: string | null;
      trayLength: string | null;
      craneReach: string | null;
      craneType: string | null;
      craneCapacity: string | null;
    }>;
    
    const updateData: VehicleUpdateData = {};
    if (data.registration !== undefined) updateData.registration = data.registration;
    if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate);
    if (data.make !== undefined) updateData.make = data.make;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.yearOfManufacture !== undefined) updateData.yearOfManufacture = data.yearOfManufacture;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.carryingCapacity !== undefined) updateData.carryingCapacity = data.carryingCapacity;
    if (data.trayLength !== undefined) updateData.trayLength = data.trayLength;
    if (data.craneReach !== undefined) updateData.craneReach = data.craneReach;
    if (data.craneType !== undefined) updateData.craneType = data.craneType;
    if (data.craneCapacity !== undefined) updateData.craneCapacity = data.craneCapacity;

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
    });

    return NextResponse.json(vehicle, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get the id from the Promise
    const { id } = await params;

    // Validate ID parameter
    const validationResult = idParamSchema.safeParse({ id });
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 });
    }

    const vehicleId = parseInt(id);

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return NextResponse.json({ message: 'Vehicle deleted successfully' }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { vehicleSchema, validateRequestBody } from '@/lib/validation';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const prisma = new PrismaClient();
const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const vehicles = await prisma.vehicle.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json(vehicles, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validate request body
    const validationResult = await validateRequestBody(request, vehicleSchema);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const data = validationResult.data;
    
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

    const vehicle = await prisma.vehicle.create({
      data: {
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
      },
    });
    
    return NextResponse.json(vehicle, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
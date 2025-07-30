import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { workLogUpdateSchema, validateRequestBody } from '@/lib/validation';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';

const prisma = new PrismaClient();
const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(req);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const log = await prisma.workLog.findUnique({
      where: { id: Number(id) },
    });
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(log, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching worklog:', error);
    return NextResponse.json({ error: 'Failed to fetch log' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(req);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    
    // Validate request body
    const validationResult = await validateRequestBody(req, workLogUpdateSchema);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const data = validationResult.data;
    const updatedLog = await prisma.workLog.update({
      where: { id: Number(id) },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        driver: data.driver,
        customer: data.customer,
        billTo: data.billTo,
        truckType: data.truckType,
        registration: data.registration,
        pickup: data.pickup,
        dropoff: data.dropoff,
        runsheet: data.runsheet,
        invoiced: data.invoiced,
        chargedHours: data.chargedHours,
        driverCharge: data.driverCharge,
        comments: data.comments,
      },
    });
    return NextResponse.json(updatedLog, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error updating worklog:', error);
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(req);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // Check authentication
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    await prisma.workLog.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json({ success: true }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error deleting worklog:', error);
    return NextResponse.json({ error: 'Failed to delete log' }, { status: 500 });
  }
}

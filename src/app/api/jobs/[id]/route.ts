import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { jobUpdateSchema, validateRequestBody } from '@/lib/validation';
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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const job = await prisma.jobs.findUnique({
      where: { id: Number(id) },
    });
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(job, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    
    // Validate request body
    const validationResult = await validateRequestBody(req, jobUpdateSchema);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const data = validationResult.data;
    
    // Only include fields that are actually provided in the request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
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

    const updatedJob = await prisma.jobs.update({
      where: { id: Number(id) },
      data: updateData,
    });
    return NextResponse.json(updatedJob, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    await prisma.jobs.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json({ success: true }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}

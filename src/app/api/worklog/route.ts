import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { workLogSchema, validateRequestBody } from '@/lib/validation';
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

    const logs = await prisma.workLog.findMany({
      orderBy: { date: 'desc' },
    });
    
    return NextResponse.json(logs, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching worklogs:', error);
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
    const validationResult = await validateRequestBody(request, workLogSchema);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const data = validationResult.data;
    const newLog = await prisma.workLog.create({
      data: {
        date: new Date(data.date),
        driver: data.driver,
        customer: data.customer,
        billTo: data.billTo,
        truckType: data.truckType || '',
        registration: data.registration || '',
        pickup: data.pickup || '',
        dropoff: data.dropoff || '',
        runsheet: data.runsheet,
        invoiced: data.invoiced,
        chargedHours: data.chargedHours,
        driverCharge: data.driverCharge,
        comments: data.comments || null,
      },
    });
    
    return NextResponse.json(newLog, { 
      status: 201,
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error creating worklog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

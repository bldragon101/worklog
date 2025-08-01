import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { jobSchema } from '@/lib/validation';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { z } from 'zod';

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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const jobs = await prisma.jobs.findMany({
      orderBy: { date: 'desc' },
    });
    
    return NextResponse.json(jobs, {
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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Log the raw request body for debugging
    const rawBody = await request.text();
    console.log('Raw request body:', rawBody);
    
    // Parse the body
    const body = JSON.parse(rawBody);
    console.log('Parsed request body:', body);

    // Validate the parsed body directly
    try {
      const validatedData = jobSchema.parse(body);
      console.log('Validated data:', validatedData);
      
      const newJob = await prisma.jobs.create({
        data: {
          date: new Date(validatedData.date),
          driver: validatedData.driver,
          customer: validatedData.customer,
          billTo: validatedData.billTo,
          truckType: validatedData.truckType,
          registration: validatedData.registration,
          pickup: validatedData.pickup || '',
          dropoff: validatedData.dropoff || '',
          runsheet: validatedData.runsheet,
          invoiced: validatedData.invoiced,
          chargedHours: validatedData.chargedHours,
          driverCharge: validatedData.driverCharge,
          comments: validatedData.comments || null,
        },
      });
      
      return NextResponse.json(newJob, { 
        status: 201,
        headers: rateLimitResult.headers
      });
    } catch (validationError) {
      console.error('Validation error:', validationError);
      if (validationError instanceof z.ZodError) {
        return NextResponse.json({ error: `Validation failed: ${validationError.message}` }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error creating worklog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

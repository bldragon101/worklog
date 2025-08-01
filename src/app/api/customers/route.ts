import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { customerSchema, validateRequestBody } from '@/lib/validation';
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
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const customers = await prisma.customer.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json(customers, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
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

    // Validate request body
    const validationResult = await validateRequestBody(request, customerSchema);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const data = validationResult.data;
    const customer = await prisma.customer.create({
      data: {
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
      },
    });
    
    return NextResponse.json(customer, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

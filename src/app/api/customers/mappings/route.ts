import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { prisma } from '@/lib/api-helpers';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Fetch customers with their bill-to mappings
    const customers = await prisma.customer.findMany({
      select: {
        customer: true,
        billTo: true,
      },
      orderBy: {
        customer: 'asc'
      }
    });

    // Create a mapping object where customer name maps to bill-to value
    const customerToBillTo: Record<string, string> = {};
    customers.forEach(c => {
      customerToBillTo[c.customer] = c.billTo;
    });

    return NextResponse.json({
      customerToBillTo
    }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching customer mappings:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
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

    // Fetch only the fields needed for selects
    const customers = await prisma.customer.findMany({
      select: {
        customer: true,
        billTo: true,
      },
      orderBy: {
        customer: 'asc'
      }
    });

    // Create unique arrays for each field
    const customerOptions = [...new Set(customers.map(c => c.customer))].sort();
    const billToOptions = [...new Set(customers.map(c => c.billTo))].sort();

    return NextResponse.json({
      customerOptions,
      billToOptions
    }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching customer select options:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
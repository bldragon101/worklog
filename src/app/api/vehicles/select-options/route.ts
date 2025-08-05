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
    const vehicles = await prisma.vehicle.findMany({
      select: {
        registration: true,
        type: true,
      },
      orderBy: {
        registration: 'asc'
      }
    });

    // Create unique arrays for each field
    const registrationOptions = vehicles.map(v => v.registration).sort();
    const truckTypeOptions = [...new Set(vehicles.map(v => v.type))].sort();

    return NextResponse.json({
      registrationOptions,
      truckTypeOptions
    }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching vehicle select options:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
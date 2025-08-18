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

    // Fetch drivers with their truck (registration) mappings
    const drivers = await prisma.driver.findMany({
      select: {
        driver: true,
        truck: true,
      },
      orderBy: {
        driver: 'asc'
      }
    });

    // Create a mapping object where driver name maps to truck (registration) value
    const driverToTruck: Record<string, string> = {};
    drivers.forEach(d => {
      driverToTruck[d.driver] = d.truck;
    });

    return NextResponse.json({
      driverToTruck
    }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching driver mappings:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
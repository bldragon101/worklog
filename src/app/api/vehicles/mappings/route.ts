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

    // Fetch vehicles with their registration to truck type mappings
    const vehicles = await prisma.vehicle.findMany({
      select: {
        registration: true,
        type: true,
      },
      orderBy: {
        registration: 'asc'
      }
    });

    // Create a mapping object where registration maps to truck type
    const registrationToType: Record<string, string> = {};
    vehicles.forEach(v => {
      registrationToType[v.registration] = v.type;
    });

    return NextResponse.json({
      registrationToType
    }, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching vehicle mappings:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
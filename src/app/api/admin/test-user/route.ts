import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Only available in development' },
        { status: 403 }
      );
    }

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

    // SECURITY: Check permissions
    const hasPermission = await checkPermission('manage_users');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden - User management permission required' },
        { status: 403 }
      );
    }

    // Create a test user in database only (not Clerk)
    const testUser = await prisma.user.create({
      data: {
        id: `test_${Date.now()}`,
        email: `testuser${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
      }
    });

    return NextResponse.json({
      message: 'Test user created',
      user: testUser
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Error creating test user:', error);
    return NextResponse.json(
      { error: 'Failed to create test user' },
      { status: 500 }
    );
  }
}
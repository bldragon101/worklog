import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const updateUserSchema = z.object({
  role: z.enum(['admin', 'manager', 'user', 'viewer']).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get latest data from Clerk
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(id);
      const enrichedUser = {
        ...user,
        firstName: clerkUser.firstName || user.firstName,
        lastName: clerkUser.lastName || user.lastName,
        imageUrl: clerkUser.imageUrl || user.imageUrl,
        email: clerkUser.primaryEmailAddress?.emailAddress || user.email,
        lastSignIn: clerkUser.lastSignInAt
      };

      return NextResponse.json(enrichedUser, {
        headers: rateLimitResult.headers
      });
    } catch {
      // If Clerk user not found, return database user
      return NextResponse.json(user, {
        headers: rateLimitResult.headers
      });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user in database
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...validatedData,
        updatedAt: new Date()
      }
    });

    // If updating name fields, also update in Clerk
    if (validatedData.firstName !== undefined || validatedData.lastName !== undefined) {
      try {
        const client = await clerkClient();
        await client.users.updateUser(id, {
          firstName: validatedData.firstName || existingUser.firstName || '',
          lastName: validatedData.lastName || existingUser.lastName || ''
        });
      } catch (clerkError) {
        console.error('Error updating user in Clerk:', clerkError);
        // Continue - database update was successful
      }
    }

    return NextResponse.json(user, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete from Clerk first
    try {
      const client = await clerkClient();
      await client.users.deleteUser(id);
    } catch (clerkError) {
      console.error('Error deleting user from Clerk:', clerkError);
      // Continue with database deletion
    }

    // Delete from database
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { 
        status: 200,
        headers: rateLimitResult.headers
      }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
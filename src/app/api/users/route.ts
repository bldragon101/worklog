import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'user', 'viewer']).default('user')
});

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

    // SECURITY: Check permissions
    const hasPermission = await checkPermission('manage_users');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden - User management permission required' },
        { status: 403 }
      );
    }

    // Get all users from database
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
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

    // Sync with Clerk to get the latest user data
    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ limit: 500 });
    
    // Create a map for quick lookup
    const clerkUserMap = new Map(clerkUsers.data.map(user => [user.id, user]));

    // Merge database users with Clerk data
    const enrichedUsers = users.map(dbUser => {
      const clerkUser = clerkUserMap.get(dbUser.id);
      return {
        ...dbUser,
        // Update with latest Clerk data if available
        firstName: clerkUser?.firstName || dbUser.firstName,
        lastName: clerkUser?.lastName || dbUser.lastName,
        imageUrl: clerkUser?.imageUrl || dbUser.imageUrl,
        email: clerkUser?.primaryEmailAddress?.emailAddress || dbUser.email,
        lastSignIn: clerkUser?.lastSignInAt
      };
    });

    return NextResponse.json(enrichedUsers, {
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // SECURITY: Check permissions
    const hasPermission = await checkPermission('manage_users');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden - User management permission required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Create user in Clerk first
    const client = await clerkClient();
    let clerkUser;
    
    try {
      clerkUser = await client.users.createUser({
        emailAddress: [validatedData.email],
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
      });

      // Note: User created without password - they'll need to use "Forgot Password" 
      // or admin can set password manually in Clerk dashboard
    } catch (clerkError: any) {
      console.error('Clerk user creation error:', clerkError);
      
      // Handle specific Clerk errors
      if (clerkError.errors) {
        const errorMessages = clerkError.errors.map((err: any) => err.message).join(', ');
        return NextResponse.json(
          { error: `Failed to create user in Clerk: ${errorMessages}` },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create user in authentication system' },
        { status: 400 }
      );
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        id: clerkUser.id,
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        imageUrl: clerkUser.imageUrl,
        role: validatedData.role,
        isActive: true,
      }
    });

    return NextResponse.json({
      user,
      message: 'User created successfully. They can use "Forgot Password" on the login page to set their password, or you can set it manually in the Clerk dashboard.'
    }, {
      status: 201,
      headers: rateLimitResult.headers
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
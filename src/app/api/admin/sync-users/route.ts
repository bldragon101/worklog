import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter, rateLimitConfigs } from '@/lib/rate-limit';
import { checkPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';

const rateLimit = createRateLimiter(rateLimitConfigs.general);

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

    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ limit: 500 });
    
    let syncedCount = 0;
    let errorCount = 0;

    // Determine roles from environment variables
    const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
    const managerUsers = process.env.MANAGER_USER_IDS?.split(',') || [];
    const viewerUsers = process.env.VIEWER_USER_IDS?.split(',') || [];

    for (const clerkUser of clerkUsers.data) {
      try {
        // Determine role
        let role = 'user'; // default
        if (adminUsers.includes(clerkUser.id)) {
          role = 'admin';
        } else if (managerUsers.includes(clerkUser.id)) {
          role = 'manager';
        } else if (viewerUsers.includes(clerkUser.id)) {
          role = 'viewer';
        }

        // Use transaction to handle race conditions and ensure data consistency
        await prisma.$transaction(async (tx) => {
          const existingUser = await tx.user.findUnique({
            where: { id: clerkUser.id }
          });

          if (existingUser) {
            // Update existing user but preserve role unless it's from env vars
            const shouldUpdateRole = adminUsers.includes(clerkUser.id) || 
                                   managerUsers.includes(clerkUser.id) || 
                                   viewerUsers.includes(clerkUser.id);
            
            await tx.user.update({
              where: { id: clerkUser.id },
              data: {
                email: clerkUser.primaryEmailAddress?.emailAddress || '',
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
                ...(shouldUpdateRole && { role }), // Only update role if user is in env vars
                updatedAt: new Date()
              }
            });
          } else {
            // Create new user with determined role
            await tx.user.create({
              data: {
                id: clerkUser.id,
                email: clerkUser.primaryEmailAddress?.emailAddress || '',
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
                role,
                isActive: true,
              }
            });
          }
        });

        syncedCount++;
      } catch (error) {
        console.error(`Error syncing user ${clerkUser.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      message: 'User sync completed',
      syncedCount,
      errorCount,
      totalClerkUsers: clerkUsers.data.length
    }, {
      headers: rateLimitResult.headers
    });

  } catch (error) {
    console.error('Error syncing users:', error);
    return NextResponse.json(
      { error: 'Failed to sync users' },
      { status: 500 }
    );
  }
}
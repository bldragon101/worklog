import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission, type PagePermission } from '@/lib/permissions';

/**
 * Whether an admin has deactivated this user. Users without a database record
 * yet (the Clerk webhook has not run) are not treated as deactivated.
 */
export async function isUserDeactivated({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  return user?.isActive === false;
}

/**
 * Middleware to protect API routes with Clerk authentication
 */
export async function requireAuth() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }

  if (await isUserDeactivated({ userId })) {
    return NextResponse.json(
      { error: 'Forbidden - Account is deactivated' },
      { status: 403 }
    );
  }
  
  return { userId };
}

/**
 * Reject a signed-in user whose role lacks any of the given permissions.
 * Returns a 403 response to return as-is, or null when access is allowed.
 */
export async function forbidWithoutPermissions({
  permissions,
  headers,
}: {
  permissions: PagePermission[];
  headers?: HeadersInit;
}) {
  const results = await Promise.all(
    permissions.map((permission) => checkPermission(permission))
  );
  if (results.every(Boolean)) return null;

  return NextResponse.json(
    { error: 'Forbidden - Insufficient permissions' },
    { status: 403, headers }
  );
}

/**
 * Reject a signed-in user whose role lacks the given permission.
 * Returns a 403 response to return as-is, or null when access is allowed.
 */
export async function forbidWithoutPermission({
  permission,
  headers,
}: {
  permission: PagePermission;
  headers?: HeadersInit;
}) {
  return forbidWithoutPermissions({ permissions: [permission], headers });
}

/**
 * Require a signed-in, active user whose role has the given permission.
 * Returns the auth result on success, or a 401/403 response to return as-is.
 */
export async function requireAuthWithPermission({
  permission,
  headers,
}: {
  permission: PagePermission;
  headers?: HeadersInit;
}) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    for (const [key, value] of new Headers(headers)) {
      authResult.headers.set(key, value);
    }
    return authResult;
  }

  const forbidden = await forbidWithoutPermission({ permission, headers });
  if (forbidden) return forbidden;

  return authResult;
}

/**
 * Get current user ID for API routes
 */
export async function getCurrentUserId() {
  const { userId } = await auth();
  return userId;
}

/**
 * Check if user has admin privileges
 * SECURITY: Only specific users can be admins
 */
export async function requireAdmin() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }
  
  // SECURITY: Define admin users (replace with your actual admin user IDs)
  const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',') || [];
  
  if (!ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json(
      { error: 'Forbidden - Admin privileges required' },
      { status: 403 }
    );
  }
  
  return { userId };
}

/**
 * SECURITY: Ensure user can only access their own data
 */
export async function requireOwnership(resourceUserId: string) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }
  
  if (userId !== resourceUserId) {
    return NextResponse.json(
      { error: 'Forbidden - You can only access your own data' },
      { status: 403 }
    );
  }
  
  return { userId };
} 
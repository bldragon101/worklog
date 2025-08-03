import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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
  
  return { userId };
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
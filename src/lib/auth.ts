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
 * Check if user has admin privileges (you can extend this based on your needs)
 */
export async function requireAdmin() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }
  
  // Add your admin role logic here
  // For now, we'll allow all authenticated users
  // You can implement role-based access control later
  
  return { userId };
} 
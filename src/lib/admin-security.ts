import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getUserRole } from '@/lib/permissions';

/**
 * SECURITY: Server-side admin validation
 * Never allow role/privilege changes from client-side
 */
export async function requireAdminForPrivilegeChange() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }

  // SECURITY: Check admin status using server-side JWT claims validation
  const userRole = getUserRole(userId);
  
  if (userRole !== 'admin') {
    console.warn(`SECURITY: Non-admin user ${userId} attempted privilege escalation`);
    return NextResponse.json(
      { error: 'Forbidden - Admin privileges required for role changes' },
      { status: 403 }
    );
  }
  
  return { userId, userRole };
}

/**
 * SECURITY: Validate admin JWT claims server-side
 * Never trust client-side role information
 */
export async function validateAdminJWTClaims() {
  const { userId, sessionClaims } = await auth();
  
  if (!userId || !sessionClaims) {
    return NextResponse.json(
      { error: 'Invalid authentication session' },
      { status: 401 }
    );
  }

  // SECURITY: Double-check admin status from environment (server-side only)
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
  const isAdmin = adminUsers.includes(userId);
  
  if (!isAdmin) {
    console.warn(`SECURITY: JWT validation failed for user ${userId} - not in admin list`);
    return NextResponse.json(
      { error: 'Admin JWT validation failed' },
      { status: 403 }
    );
  }
  
  return { userId, isValidAdmin: true };
}

/**
 * SECURITY: Log privilege escalation attempts
 */
export function logPrivilegeAttempt(userId: string, action: string, success: boolean) {
  const timestamp = new Date().toISOString();
  const status = success ? 'SUCCESS' : 'BLOCKED';
  
  console.log(`SECURITY LOG [${timestamp}]: User ${userId} attempted ${action} - ${status}`);
  
  // In production, send to security monitoring system
  // Example: await sendToSecurityLog({ userId, action, success, timestamp });
}

/**
 * SECURITY: Create audit trail for admin actions
 */
export function createAdminAuditLog(adminUserId: string, action: string, target?: string, data?: Record<string, unknown>) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    adminUserId,
    action,
    target,
    data: data ? JSON.stringify(data) : null,
    ipAddress: 'server-side', // In production, capture real IP
  };
  
  console.log('ADMIN AUDIT:', auditEntry);
  
  // In production, store in dedicated audit table
  // await auditLog.create(auditEntry);
}
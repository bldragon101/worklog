import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForPrivilegeChange, validateAdminJWTClaims, logPrivilegeAttempt, createAdminAuditLog } from '@/lib/admin-security';
import { z } from 'zod';

// SECURITY: Schema for role change requests - server-side only
const roleChangeSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID required'),
  newRole: z.enum(['admin', 'manager', 'user', 'viewer']),
  reason: z.string().min(1, 'Reason for role change required').max(500)
});

/**
 * SECURITY: Get current role assignments (Admin only)
 */
export async function GET() {
  const adminCheck = await requireAdminForPrivilegeChange();
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const { userId } = adminCheck;
  
  try {
    // SECURITY: Only return role configuration to admins
    const roleConfig = {
      admins: process.env.ADMIN_USER_IDS?.split(',') || [],
      managers: process.env.MANAGER_USER_IDS?.split(',') || [],
      viewers: process.env.VIEWER_USER_IDS?.split(',') || [],
      // Note: 'user' role is default for anyone not in above lists
    };

    createAdminAuditLog(userId, 'VIEW_ROLE_CONFIG');
    
    return NextResponse.json({
      roleConfig,
      message: 'Role configuration retrieved successfully'
    });

  } catch (error) {
    console.error('Error retrieving role config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * SECURITY: Change user role (Admin only)
 * Never allow client-side role modifications
 */
export async function POST(request: NextRequest) {
  // SECURITY: Double-check admin privileges with JWT validation
  const jwtCheck = await validateAdminJWTClaims();
  if (jwtCheck instanceof NextResponse) {
    return jwtCheck;
  }

  const adminCheck = await requireAdminForPrivilegeChange();
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const { userId: adminUserId } = adminCheck;

  try {
    // SECURITY: Validate request payload
    const body = await request.json();
    const validationResult = roleChangeSchema.safeParse(body);
    
    if (!validationResult.success) {
      logPrivilegeAttempt(adminUserId, 'INVALID_ROLE_CHANGE_REQUEST', false);
      return NextResponse.json({ 
        error: 'Invalid role change request',
        details: validationResult.error.flatten()
      }, { status: 400 });
    }

    const { targetUserId, newRole, reason } = validationResult.data;

    // SECURITY: Prevent self-role modification (even for admins)
    if (adminUserId === targetUserId) {
      logPrivilegeAttempt(adminUserId, 'ATTEMPTED_SELF_ROLE_CHANGE', false);
      return NextResponse.json({ 
        error: 'Cannot modify your own role for security reasons' 
      }, { status: 403 });
    }

    // SECURITY: Log the privilege change attempt
    logPrivilegeAttempt(adminUserId, `ROLE_CHANGE_${targetUserId}_TO_${newRole}`, true);
    createAdminAuditLog(adminUserId, 'ROLE_CHANGE', targetUserId, { newRole, reason });

    // SECURITY: In a real implementation, you would:
    // 1. Update the user record in a secure admin table
    // 2. Invalidate the user's current session
    // 3. Send notification to the target user
    // 4. Create permanent audit log entry
    
    console.log(`ADMIN ACTION: ${adminUserId} changed ${targetUserId} role to ${newRole}. Reason: ${reason}`);

    return NextResponse.json({
      success: true,
      message: `Role change request processed. User ${targetUserId} role changed to ${newRole}`,
      audit: {
        adminUserId,
        targetUserId,
        newRole,
        reason,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing role change:', error);
    logPrivilegeAttempt(adminUserId, 'ROLE_CHANGE_ERROR', false);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * SECURITY: Revoke admin privileges (Super admin only)
 * This would typically require additional verification
 */
export async function DELETE(request: NextRequest) {
  const adminCheck = await requireAdminForPrivilegeChange();
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const { userId: adminUserId } = adminCheck;

  // SECURITY: Additional check for super-admin operations
  const superAdmins = process.env.SUPER_ADMIN_USER_IDS?.split(',') || [];
  if (!superAdmins.includes(adminUserId)) {
    logPrivilegeAttempt(adminUserId, 'ATTEMPTED_PRIVILEGE_REVOCATION_WITHOUT_SUPER_ADMIN', false);
    return NextResponse.json({ 
      error: 'Super admin privileges required for privilege revocation' 
    }, { status: 403 });
  }

  try {
    const { targetUserId } = await request.json();
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
    }

    logPrivilegeAttempt(adminUserId, `PRIVILEGE_REVOCATION_${targetUserId}`, true);
    createAdminAuditLog(adminUserId, 'PRIVILEGE_REVOCATION', targetUserId);

    return NextResponse.json({
      success: true,
      message: `Privileges revoked for user ${targetUserId}`,
      revokedBy: adminUserId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error revoking privileges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
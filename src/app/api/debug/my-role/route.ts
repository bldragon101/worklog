import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Only available in development' },
        { status: 403 }
      );
    }

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const role = await getUserRole(userId);

    // Check environment variables
    const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
    const isInAdminEnv = adminUsers.includes(userId);

    return NextResponse.json({
      userId,
      role,
      isInAdminEnv,
      adminUsersFromEnv: adminUsers,
      canManageUsers: role === 'admin'
    });
  } catch (error) {
    console.error('Debug role error:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    );
  }
}
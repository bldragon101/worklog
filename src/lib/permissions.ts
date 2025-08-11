import { auth } from '@clerk/nextjs/server';

// Define user roles
export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

// Define page permissions
export type PagePermission = 
  | 'view_overview'
  | 'view_jobs' 
  | 'create_jobs'
  | 'edit_jobs'
  | 'delete_jobs'
  | 'view_customers' 
  | 'create_customers'
  | 'edit_customers'
  | 'delete_customers'
  | 'view_vehicles'
  | 'create_vehicles' 
  | 'edit_vehicles'
  | 'delete_vehicles'
  | 'view_drivers'
  | 'create_drivers'
  | 'edit_drivers'
  | 'delete_drivers'
  | 'view_reports'
  | 'view_analytics'
  | 'view_maintenance'
  | 'access_settings'
  | 'manage_users'
  | 'manage_integrations'
  | 'view_history';

// Define role-based permissions
const ROLE_PERMISSIONS: Record<UserRole, PagePermission[]> = {
  admin: [
    'view_overview',
    'view_jobs', 'create_jobs', 'edit_jobs', 'delete_jobs',
    'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
    'view_vehicles', 'create_vehicles', 'edit_vehicles', 'delete_vehicles',
    'view_drivers', 'create_drivers', 'edit_drivers', 'delete_drivers',
    'view_reports', 'view_analytics', 'view_maintenance',
    'access_settings', 'manage_users', 'manage_integrations', 'view_history'
  ],
  manager: [
    'view_overview',
    'view_jobs', 'create_jobs', 'edit_jobs', 'delete_jobs',
    'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
    'view_vehicles', 'create_vehicles', 'edit_vehicles', 'delete_vehicles',
    'view_drivers', 'create_drivers', 'edit_drivers', 'delete_drivers',
    'view_reports', 'view_analytics', 'view_maintenance'
  ],
  user: [
    'view_overview',
    'view_jobs', 'create_jobs', 'edit_jobs',
    'view_customers', 'create_customers', 'edit_customers',
    'view_vehicles', 'view_drivers',
    'view_reports'
  ],
  viewer: [
    'view_overview',
    'view_jobs',
    'view_customers',
    'view_vehicles',
    'view_drivers',
    'view_reports'
  ]
};

/**
 * Get user role based on Clerk user ID
 * You can customize this logic based on your needs
 */
export function getUserRole(userId: string): UserRole {
  // Get admin user IDs from environment
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
  const managerUsers = process.env.MANAGER_USER_IDS?.split(',') || [];
  const viewerUsers = process.env.VIEWER_USER_IDS?.split(',') || [];

  if (adminUsers.includes(userId)) {
    return 'admin';
  } else if (managerUsers.includes(userId)) {
    return 'manager';
  } else if (viewerUsers.includes(userId)) {
    return 'viewer';
  } else {
    return 'user'; // Default role
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: PagePermission): boolean {
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

/**
 * Get current user's role (server-side)
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return getUserRole(userId);
}

/**
 * Check if current user has permission (server-side)
 */
export async function checkPermission(permission: PagePermission): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  if (!userRole) return false;
  return hasPermission(userRole, permission);
}

/**
 * Require specific permission (server-side middleware)
 */
export async function requirePermission(permission: PagePermission) {
  const hasAccess = await checkPermission(permission);
  if (!hasAccess) {
    throw new Error(`Access denied: ${permission} permission required`);
  }
}

/**
 * Get user permissions for client-side use
 */
export async function getUserPermissions(): Promise<PagePermission[]> {
  const userRole = await getCurrentUserRole();
  if (!userRole) return [];
  return ROLE_PERMISSIONS[userRole];
}
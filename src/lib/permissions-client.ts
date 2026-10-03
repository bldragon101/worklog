// Client-safe permission utilities
import { UserRole, PagePermission } from "@/lib/permissions";

// Define role-based permissions (duplicated for client-side use)
const ROLE_PERMISSIONS: Record<UserRole, PagePermission[]> = {
  admin: [
    "view_overview",
    "view_jobs",
    "create_jobs",
    "edit_jobs",
    "delete_jobs",
    "view_customers",
    "create_customers",
    "edit_customers",
    "delete_customers",
    "view_vehicles",
    "create_vehicles",
    "edit_vehicles",
    "delete_vehicles",
    "view_drivers",
    "create_drivers",
    "edit_drivers",
    "delete_drivers",
    "view_reports",
    "view_analytics",
    "view_maintenance",
    "access_settings",
    "manage_users",
    "manage_integrations",
    "view_history",
    "manage_jobs_report",
    "manage_driver_bank_details",
    "manage_company_settings",
    "manage_tolls",
  ],
  manager: [
    "view_overview",
    "view_jobs",
    "create_jobs",
    "edit_jobs",
    "delete_jobs",
    "view_customers",
    "create_customers",
    "edit_customers",
    "delete_customers",
    "view_vehicles",
    "create_vehicles",
    "edit_vehicles",
    "delete_vehicles",
    "view_drivers",
    "create_drivers",
    "edit_drivers",
    "delete_drivers",
    "view_reports",
    "view_analytics",
    "view_maintenance",
  ],
  user: [
    "view_overview",
    "view_jobs",
    "create_jobs",
    "edit_jobs",
    "view_customers",
    "create_customers",
    "edit_customers",
    "view_vehicles",
    "view_drivers",
    "view_reports",
  ],
  viewer: [
    "view_overview",
    "view_jobs",
    "view_customers",
    "view_vehicles",
    "view_drivers",
    "view_reports",
  ],
};

/**
 * Get all permissions for a role (client-side)
 */
export function getRolePermissionsClient(userRole: UserRole): PagePermission[] {
  return ROLE_PERMISSIONS[userRole];
}

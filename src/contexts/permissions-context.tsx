"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { UserRole, PagePermission } from "@/lib/permissions";
import { getRolePermissionsClient } from "@/lib/permissions-client";
import { queryKeys } from "@/lib/query-keys";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

/**
 * Sync the user's role from the database to their Clerk metadata and return
 * it, falling back to reading the role without syncing. Returns null when the
 * role could not be read, so the default role is kept.
 */
async function fetchSyncedRole({
  user,
}: {
  user: ClerkUser;
}): Promise<UserRole | null> {
  try {
    // Force sync role from database to Clerk metadata
    const syncResponse = await fetch("/api/user/sync-role", {
      method: "POST",
    });

    if (syncResponse.ok) {
      const data = await syncResponse.json();

      // Reload user to get updated metadata
      await user.reload();
      return data.role as UserRole;
    }

    // Fallback: fetch role without syncing
    const response = await fetch("/api/user/role");
    if (response.ok) {
      const data = await response.json();
      return data.role as UserRole;
    }
    // If all else fails, keep default 'user' role
    return null;
  } catch (error) {
    console.error("Error fetching user role:", error);
    // Keep default 'user' role on error
    return null;
  }
}

interface PermissionsContextType {
  userRole: UserRole | null;
  permissions: PagePermission[];
  checkPermission: (permission: PagePermission) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isLoading: boolean;
  refreshRole: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined,
);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();

  // Role from Clerk's public metadata (cached in the session), available
  // immediately without a request
  const roleFromMetadata = user?.publicMetadata?.role as UserRole | undefined;

  // If the role is not in the metadata, fetch it from the database
  const roleQuery = useQuery({
    queryKey: queryKeys.user.syncedRole({ userId: user?.id ?? "" }),
    queryFn: () => (user ? fetchSyncedRole({ user }) : null),
    enabled: isLoaded && !!user && !roleFromMetadata,
  });

  // Default to the 'user' role to prevent sidebar flickering
  const userRole: UserRole | null =
    (isLoaded && user ? (roleQuery.data ?? roleFromMetadata) : null) ?? "user";
  const permissions = getRolePermissionsClient(userRole);
  const isLoading = roleQuery.isFetching;

  const refreshRole = async () => {
    if (!isLoaded || !user) {
      return;
    }
    await roleQuery.refetch();
  };

  const checkPermission = (permission: PagePermission): boolean => {
    return permissions?.includes(permission) ?? false;
  };

  const isAdmin = userRole === "admin";
  const isManager = userRole === "manager" || userRole === "admin";
  const canEdit =
    checkPermission("edit_jobs") ||
    checkPermission("edit_customers") ||
    checkPermission("edit_vehicles");
  const canDelete =
    checkPermission("delete_jobs") ||
    checkPermission("delete_customers") ||
    checkPermission("delete_vehicles");

  const value: PermissionsContextType = {
    userRole,
    permissions,
    checkPermission,
    isAdmin,
    isManager,
    canEdit,
    canDelete,
    isLoading,
    refreshRole,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

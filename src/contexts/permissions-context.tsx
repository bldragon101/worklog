"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useUser } from "@clerk/nextjs";
import { UserRole, PagePermission } from "@/lib/permissions";
import { getRolePermissionsClient } from "@/lib/permissions-client";

interface PermissionsContextType {
  userRole: UserRole | null;
  permissions: PagePermission[];
  checkPermission: (permission: PagePermission) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined,
);

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  // Initialize with 'user' role to prevent sidebar flickering
  const [userRole, setUserRole] = useState<UserRole | null>("user");
  const [permissions, setPermissions] = useState<PagePermission[]>(
    getRolePermissionsClient("user"),
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchUserRole() {
      if (!isLoaded) {
        return;
      }

      if (!user) {
        // Already initialized with 'user' defaults
        return;
      }

      try {
        // First try to get role from Clerk's public metadata (cached in session)
        const roleFromMetadata = user.publicMetadata?.role as
          | UserRole
          | undefined;

        if (roleFromMetadata) {
          // Role is available immediately from Clerk session
          setUserRole(roleFromMetadata);
          setPermissions(getRolePermissionsClient(roleFromMetadata));
          return;
        }

        // If not in metadata, sync role from database to Clerk metadata
        // Set loading only when we need to fetch
        setIsLoading(true);

        const syncResponse = await fetch("/api/user/sync-role", {
          method: "POST",
        });

        if (syncResponse.ok) {
          const data = await syncResponse.json();
          const role = data.role as UserRole;
          setUserRole(role);
          setPermissions(getRolePermissionsClient(role));

          // Reload user to get updated metadata
          await user.reload();
        } else {
          // Fallback: fetch role without syncing
          const response = await fetch("/api/user/role");
          if (response.ok) {
            const data = await response.json();
            const role = data.role as UserRole;
            setUserRole(role);
            setPermissions(getRolePermissionsClient(role));
          }
          // If all else fails, keep default 'user' role (already set)
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user role:", error);
        // Keep default 'user' role on error (already set)
        setIsLoading(false);
      }
    }

    fetchUserRole();
  }, [user, isLoaded]);

  const checkPermission = useCallback(
    (permission: PagePermission): boolean => {
      return permissions?.includes(permission) ?? false;
    },
    [permissions],
  );

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

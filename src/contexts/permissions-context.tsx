"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  const [userRole, setUserRole] = useState<UserRole | null>("user");
  const [permissions, setPermissions] = useState<PagePermission[]>(
    getRolePermissionsClient("user"),
  );
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    async function fetchUserRole() {
      if (isLoaded && user && !isCached) {
        try {
          const response = await fetch("/api/user/role");
          if (response.ok) {
            const data = await response.json();
            const role = data.role as UserRole;
            setUserRole(role);
            setPermissions(getRolePermissionsClient(role));
            setIsCached(true);
          } else {
            // Keep default user role
            setIsCached(true);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          // Keep default user role
          setIsCached(true);
        }
      } else if (isLoaded && !user) {
        setUserRole("user");
        setPermissions(getRolePermissionsClient("user"));
        setIsCached(false);
      }
    }

    fetchUserRole();
  }, [user, isLoaded, isCached]);

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
    isLoading: false,
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

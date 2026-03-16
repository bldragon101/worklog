"use client";

import { useState, useEffect } from "react";

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 4,
  manager: 3,
  user: 2,
  viewer: 1,
};

export function useQuickEditPermission(): {
  canUseQuickEdit: boolean;
  isLoading: boolean;
} {
  const [canUseQuickEdit, setCanUseQuickEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const [settingsRes, roleRes] = await Promise.all([
          fetch("/api/admin/quick-edit-settings"),
          fetch("/api/user/role"),
        ]);

        if (!settingsRes.ok || !roleRes.ok) {
          setCanUseQuickEdit(false);
          return;
        }

        const settingsData = await settingsRes.json();
        const roleData = await roleRes.json();

        const minRole = settingsData.quickEditMinRole || "admin";
        const userRole = roleData.role || "viewer";

        const userLevel = ROLE_HIERARCHY[userRole] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 4;

        setCanUseQuickEdit(userLevel >= requiredLevel);
      } catch (error) {
        console.error("Error checking quick edit permission:", error);
        setCanUseQuickEdit(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, []);

  return { canUseQuickEdit, isLoading };
}

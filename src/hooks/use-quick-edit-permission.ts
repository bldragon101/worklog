"use client";

import { useQuery } from "@tanstack/react-query";
import { quickEditSettingsQuery, userRoleQuery } from "@/lib/queries";

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
  const settingsQuery = useQuery(quickEditSettingsQuery);
  const roleQuery = useQuery(userRoleQuery);

  const isLoading = settingsQuery.isPending || roleQuery.isPending;

  if (!settingsQuery.data || !roleQuery.data) {
    return { canUseQuickEdit: false, isLoading };
  }

  const minRole = (settingsQuery.data.quickEditMinRole || "admin")
    .toLowerCase()
    .trim();
  const userRole = (roleQuery.data.role || "viewer").toLowerCase().trim();

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 4;

  return { canUseQuickEdit: userLevel >= requiredLevel, isLoading };
}

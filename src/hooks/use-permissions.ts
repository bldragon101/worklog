"use client";

// Re-export from the permissions context to maintain backward compatibility
// This hook now uses the PermissionsProvider context which caches permissions
// and prevents re-fetching on every component mount
export { usePermissions } from "@/contexts/permissions-context";

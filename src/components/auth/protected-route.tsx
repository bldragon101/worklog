"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { PagePermission, UserRole } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PagePermission;
  requiredRole?: UserRole;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
  fallbackTitle,
  fallbackDescription,
}: ProtectedRouteProps) {
  const { checkPermission, userRole, isAdmin, isManager, isLoading } =
    usePermissions();

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading permissions...
          </p>
        </div>
      </div>
    );
  }

  // Check role-based access
  const hasRoleAccess = requiredRole
    ? requiredRole === "admin"
      ? isAdmin
      : requiredRole === "manager"
        ? isManager
        : userRole === requiredRole
    : true;

  // Check permission-based access
  const hasPermissionAccess = requiredPermission
    ? checkPermission(requiredPermission)
    : true;

  // Compute specific missing access flags
  const missingRole = requiredRole && !hasRoleAccess;
  const missingPermission = requiredPermission && !hasPermissionAccess;

  if (!hasRoleAccess || !hasPermissionAccess) {
    // Determine the appropriate error message
    let errorMessage: string;
    if (fallbackDescription) {
      errorMessage = fallbackDescription;
    } else if (missingPermission) {
      errorMessage = `You don't have permission to access this page. Required permission: ${requiredPermission}`;
    } else if (missingRole) {
      errorMessage = `You don't have permission to access this page. Required role: ${requiredRole}`;
    } else {
      errorMessage = "You don't have permission to access this page.";
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
              <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">
              {fallbackTitle || "Access Restricted"}
            </CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your current role:{" "}
              <span className="font-medium capitalize">
                {userRole || "none"}
              </span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Contact your administrator if you believe this is an error.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/overview" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Overview
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

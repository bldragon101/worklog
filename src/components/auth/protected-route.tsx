"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { PagePermission } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission: PagePermission;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  fallbackTitle,
  fallbackDescription,
}: ProtectedRouteProps) {
  const { checkPermission, isLoading, userRole } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!checkPermission(requiredPermission)) {
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
            <CardDescription>
              {fallbackDescription ||
                `You don't have permission to access this page. Required permission: ${requiredPermission}`}
            </CardDescription>
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

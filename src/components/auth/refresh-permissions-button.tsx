"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";

interface RefreshPermissionsButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function RefreshPermissionsButton({
  variant = "outline",
  size = "default",
  showLabel = true,
}: RefreshPermissionsButtonProps) {
  const { refreshRole, isLoading: permissionsLoading } = usePermissions();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshRole();

      setJustRefreshed(true);
      toast({
        title: "Permissions Refreshed",
        description: "Your role and permissions have been updated successfully.",
      });

      // Reset the success state after 3 seconds
      setTimeout(() => {
        setJustRefreshed(false);
      }, 3000);
    } catch (error) {
      console.error("Error refreshing permissions:", error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh permissions. Please try signing out and back in.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = isRefreshing || permissionsLoading;

  return (
    <Button
      id="refresh-permissions-btn"
      type="button"
      variant={variant}
      size={size}
      onClick={handleRefresh}
      disabled={isLoading || justRefreshed}
      className="gap-2"
    >
      {justRefreshed ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <RefreshCw
          className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
        />
      )}
      {showLabel && (
        <span>
          {isLoading
            ? "Refreshing..."
            : justRefreshed
              ? "Refreshed"
              : "Refresh Permissions"}
        </span>
      )}
    </Button>
  );
}

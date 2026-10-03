"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";

export function TollRefreshButton() {
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsStarting(true);
    try {
      await fetchJson<{ started: boolean }>({
        url: "/api/tolls/refresh",
        init: { method: "POST" },
        fallbackMessage: "Failed to start Linkt sync",
      });
      toast({
        title: "Linkt sync started",
        description:
          "Trips from the last 14 days are being downloaded. Reload this page in a few minutes to see them.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error starting Linkt sync:", error);
      toast({
        title: "Could not refresh from Linkt",
        description:
          error instanceof Error ? error.message : "Failed to start Linkt sync",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Button
      id="toll-refresh-btn"
      type="button"
      size="sm"
      variant="outline"
      onClick={handleRefresh}
      disabled={isStarting}
      className="h-8 rounded"
    >
      {isStarting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">Refresh from Linkt</span>
      <span className="sm:hidden">Refresh</span>
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";
import type { TollDriveImportResult } from "@/lib/tolls/toll-types";

function describeResult({ result }: { result: TollDriveImportResult }): string {
  if (result.status !== "imported") {
    return "Set the Linkt folder in Settings > Integrations first.";
  }
  if (result.files.length === 0) {
    return `No new files in ${result.folder}.`;
  }
  const inserted = result.files.reduce((total, file) => total + file.inserted, 0);
  const unreadable = result.files.reduce((total, file) => total + file.errors.length, 0);
  const unreadableNote = unreadable > 0 ? ` ${unreadable} rows could not be read.` : "";
  return `${inserted} new trips from ${result.files.length} file${result.files.length === 1 ? "" : "s"}.${unreadableNote}`;
}

export function TollDriveImportButton({
  onImportSuccess,
}: {
  onImportSuccess?: () => void;
}) {
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await fetchJson<TollDriveImportResult>({
        url: "/api/tolls/drive-import",
        init: { method: "POST" },
        fallbackMessage: "Failed to import Linkt files from Google Drive",
      });
      toast({
        title:
          result.status === "imported"
            ? "Imported from Google Drive"
            : "Linkt folder not set",
        description: describeResult({ result }),
        variant: result.status === "imported" ? "success" : "default",
      });
      onImportSuccess?.();
    } catch (error) {
      console.error("Error importing Linkt files from Google Drive:", error);
      toast({
        title: "Could not import from Google Drive",
        description:
          error instanceof Error
            ? error.message
            : "Failed to import Linkt files from Google Drive",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      id="toll-drive-import-btn"
      type="button"
      size="sm"
      variant="outline"
      onClick={handleImport}
      disabled={isImporting}
      className="h-8 rounded"
    >
      {isImporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">Import from Drive</span>
      <span className="sm:hidden">Drive</span>
    </Button>
  );
}

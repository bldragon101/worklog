"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";
import type { TollImportSummary } from "@/lib/tolls/import-toll-trips";

type TollImportResponse = TollImportSummary & {
  skipped: number;
  errors: string[];
};

export function TollUploadButton({
  onImportSuccess,
}: {
  onImportSuccess?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const openFilePicker = () => inputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await fetchJson<TollImportResponse>({
        url: "/api/tolls/import",
        init: { method: "POST", body: formData },
        fallbackMessage: "Failed to import Linkt trips",
      });

      const skippedNote =
        result.skipped > 0 ? ` ${result.skipped} rows could not be read.` : "";
      toast({
        title: "Linkt trips imported",
        description: `${result.inserted} new trips, ${result.duplicates} already imported.${skippedNote}`,
        variant: result.skipped > 0 ? "default" : "success",
      });
      onImportSuccess?.();
    } catch (error) {
      console.error("Error importing Linkt trips:", error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Failed to import Linkt trips",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        id="toll-upload-input"
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        id="toll-upload-btn"
        type="button"
        size="sm"
        onClick={openFilePicker}
        disabled={isUploading}
        className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 h-8 rounded"
      >
        {isUploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">Upload Linkt CSV</span>
        <span className="sm:hidden">Upload</span>
      </Button>
    </>
  );
}

"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@/lib/types";
import type { JobsPdfAppliedFilter } from "./jobs-pdf-template";

interface JobsPdfExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleJobs: Job[];
  selectedJobs: Job[];
  periodLabel?: string;
  appliedFilters: JobsPdfAppliedFilter[];
  search: string;
}

function buildFileName({ periodLabel }: { periodLabel?: string }): string {
  const slug = (periodLabel ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `jobs-${slug}.pdf` : "jobs.pdf";
}

function downloadBlob({ blob, fileName }: { blob: Blob; fileName: string }) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Confirms which jobs go into the PDF (everything currently shown, or just the
 * selected rows) and downloads the rendered file.
 */
export function JobsPdfExportDialog({
  open,
  onOpenChange,
  visibleJobs,
  selectedJobs,
  periodLabel,
  appliedFilters,
  search,
}: JobsPdfExportDialogProps) {
  const { toast } = useToast();
  const [onlySelected, setOnlySelected] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const hasSelection = selectedJobs.length > 0;
  const exportSelected = hasSelection && onlySelected;
  const jobsToExport = exportSelected ? selectedJobs : visibleJobs;
  const trimmedSearch = search.trim();

  const handleExport = async () => {
    if (jobsToExport.length === 0) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/export/jobs/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobIds: jobsToExport.map((job) => job.id),
          periodLabel,
          appliedFilters,
          search: trimmedSearch || undefined,
          selectedOnly: exportSelected,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || "Failed to export jobs to PDF");
      }

      downloadBlob({
        blob: await response.blob(),
        fileName: buildFileName({ periodLabel }),
      });
      onOpenChange(false);
      toast({
        title: "PDF exported",
        description: `${jobsToExport.length} job${jobsToExport.length === 1 ? "" : "s"} exported`,
      });
    } catch (error) {
      console.error("Error exporting jobs to PDF:", error);
      toast({
        title: "Export failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export jobs to PDF</DialogTitle>
          <DialogDescription>
            Creates a landscape PDF of the jobs shown, grouped by day with
            totals. Current filters and search are applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded border bg-muted/40 p-3">
            {periodLabel && (
              <>
                <dt className="text-muted-foreground">Period</dt>
                <dd className="font-medium">{periodLabel}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Jobs</dt>
            <dd className="font-medium">{jobsToExport.length}</dd>
            {appliedFilters.map((filter) => (
              <div key={filter.label} className="contents">
                <dt className="text-muted-foreground">{filter.label}</dt>
                <dd className="truncate" title={filter.values.join(", ")}>
                  {filter.values.join(", ")}
                </dd>
              </div>
            ))}
            {trimmedSearch && (
              <>
                <dt className="text-muted-foreground">Search</dt>
                <dd className="truncate">&quot;{trimmedSearch}&quot;</dd>
              </>
            )}
          </dl>

          {hasSelection && (
            <div className="flex items-center justify-between gap-3 rounded border p-3">
              <Label
                htmlFor="export-pdf-selected-only-switch"
                className="cursor-pointer font-normal"
              >
                Only export the {selectedJobs.length} selected job
                {selectedJobs.length === 1 ? "" : "s"}
              </Label>
              <Switch
                id="export-pdf-selected-only-switch"
                checked={onlySelected}
                onCheckedChange={setOnlySelected}
              />
            </div>
          )}

          {jobsToExport.length === 0 && (
            <p className="text-muted-foreground">
              There are no jobs to export. Adjust the period or filters and try
              again.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            id="cancel-pdf-export-btn"
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            id="confirm-pdf-export-btn"
            type="button"
            onClick={handleExport}
            disabled={isExporting || jobsToExport.length === 0}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

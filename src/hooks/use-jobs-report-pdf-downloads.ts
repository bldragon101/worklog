import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { JobsReport } from "@/lib/types";

/**
 * Builds the PDF URL for a report. A draft passes its on-page deduction
 * adjustments so the PDF matches what finalising would apply.
 */
function buildPdfUrl({
  report,
  pendingDeductionAdjustments,
}: {
  report: JobsReport;
  pendingDeductionAdjustments: Map<number, number | null>;
}): string {
  const url = `/api/jobs-report/${report.id}/pdf`;
  if (report.status !== "draft" || pendingDeductionAdjustments.size === 0) {
    return url;
  }
  const overrides = Object.fromEntries(pendingDeductionAdjustments);
  return `${url}?deductionOverrides=${encodeURIComponent(JSON.stringify(overrides))}`;
}

/**
 * Downloads the selected jobs report's PDF, or every filtered report that has
 * jobs. The selected draft's PDF includes its on-page deduction adjustments.
 */
export function useJobsReportPdfDownloads({
  selectedReport,
  filteredReports,
  pendingDeductionAdjustments,
}: {
  selectedReport: JobsReport | null;
  filteredReports: JobsReport[];
  pendingDeductionAdjustments: Map<number, number | null>;
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingAllPdfs, setIsDownloadingAllPdfs] = useState(false);

  const handleDownloadAllPdfs = async () => {
    const toDl = filteredReports.filter((r) => (r.lines?.length ?? 0) > 0);
    if (toDl.length === 0) {
      toast({
        title: "No Reports",
        description: "No reports with jobs to download",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingAllPdfs(true);
    let successCount = 0;
    let failCount = 0;

    for (const report of toDl) {
      try {
        const response = await fetch(`/api/jobs-report/${report.id}/pdf`);
        if (!response.ok) {
          failCount++;
          continue;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.reportNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
        successCount++;
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        });
      } catch {
        failCount++;
      }
    }

    setIsDownloadingAllPdfs(false);

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""}`,
      });
    } else {
      toast({
        title: "Partially Successful",
        description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""}. ${failCount} failed.`,
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedReport) return;
    setIsDownloadingPdf(true);
    try {
      const response = await fetch(
        buildPdfUrl({ report: selectedReport, pendingDeductionAdjustments }),
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to generate PDF",
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedReport.reportNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return {
    isDownloadingPdf,
    isDownloadingAllPdfs,
    handleDownloadPdf,
    handleDownloadAllPdfs,
  };
}

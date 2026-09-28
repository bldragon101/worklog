import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { Rcti } from "@/lib/types";

/**
 * Downloads the selected RCTI's PDF, or every RCTI with lines that matches the
 * current driver and status filters.
 */
export function useRctiPdfDownloads({
  selectedRcti,
  rctis,
  selectedDriverIds,
  statusFilter,
}: {
  selectedRcti: Rcti | null;
  rctis: Rcti[];
  selectedDriverIds: string[];
  statusFilter: string;
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingAllPdfs, setIsDownloadingAllPdfs] = useState(false);

  const handleDownloadPdf = async () => {
    if (!selectedRcti) return;

    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/pdf`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PDF");
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedRcti.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
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

  const handleDownloadAllPdfs = async () => {
    setIsDownloadingAllPdfs(true);

    try {
      // Get filtered RCTIs based on current filters
      const filteredRctis = rctis.filter((rcti) => {
        const matchesDriver =
          selectedDriverIds.length === 0 ||
          selectedDriverIds.includes(rcti.driverId.toString());
        const matchesStatus =
          statusFilter === "all" || rcti.status === statusFilter;
        const hasLines = rcti.lines && rcti.lines.length > 0;
        return matchesDriver && matchesStatus && hasLines;
      });

      if (filteredRctis.length === 0) {
        toast({
          title: "No RCTIs Found",
          description: "No RCTIs with lines match the current filters",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failedRctis: string[] = [];

      // Download each RCTI PDF with a small delay between downloads
      for (let i = 0; i < filteredRctis.length; i++) {
        const rcti = filteredRctis[i];
        try {
          const response = await fetch(`/api/rcti/${rcti.id}/pdf`);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || "Failed to generate PDF";
            throw new Error(errorMessage);
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${rcti.invoiceNumber}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          successCount++;

          // Add delay between downloads to avoid overwhelming the browser
          if (i < filteredRctis.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            `Error downloading PDF for ${rcti.invoiceNumber}:`,
            errorMessage,
            `\nRCTI ID: ${rcti.id}, Status: ${rcti.status}, Lines: ${rcti.lines?.length || 0}`,
          );
          failCount++;
          failedRctis.push(rcti.invoiceNumber);
        }
      }

      if (failCount === 0) {
        toast({
          title: "Success",
          description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""} successfully`,
        });
      } else if (successCount === 0) {
        toast({
          title: "Error",
          description: `Failed to download all PDFs. Check RCTI settings are configured.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""}. Failed: ${failCount} (${failedRctis.slice(0, 3).join(", ")}${failedRctis.length > 3 ? "..." : ""})`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading PDFs:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to download PDFs",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAllPdfs(false);
    }
  };

  return {
    isDownloadingPdf,
    isDownloadingAllPdfs,
    handleDownloadPdf,
    handleDownloadAllPdfs,
  };
}

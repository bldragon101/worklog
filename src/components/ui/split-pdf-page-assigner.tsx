"use client";

import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Scissors, Upload, ZoomIn } from "lucide-react";
import type { Job } from "@/lib/types";
import {
  groupPageAssignments,
  suggestPageAssignments,
  type PageAssignment,
  type PageSuggestionReason,
  type SplitAttachmentType,
} from "@/lib/utils/pdf-page-matching";
import { splitPdfIntoGroups, type SplitPdfFile } from "@/lib/utils/pdf-split";
import {
  ATTACHMENT_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
  formatJobLabel,
} from "@/components/ui/multi-job-attachment-upload";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_SOURCE_PDF_SIZE = 50 * 1024 * 1024;
const SKIP_VALUE = "skip";
const THUMBNAIL_WIDTH = 150;
const PREVIEW_WIDTH = 640;

const REASON_LABELS: Record<PageSuggestionReason, string> = {
  matched: "Matched from page text",
  continuation: "Follows previous page",
  sequential: "Suggested by date order",
};

interface SplitPdfPageAssignerProps {
  jobs: Job[];
  disabled: boolean;
  onAddFiles: ({ files }: { files: SplitPdfFile[] }) => void;
  onSplittingChange: ({ isSplitting }: { isSplitting: boolean }) => void;
}

async function extractPageTexts({
  pdf,
}: {
  pdf: PDFDocumentProxy;
}): Promise<string[]> {
  const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
  return Promise.all(
    pageNumbers.map(async (pageNumber) => {
      try {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        return content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
      } catch (error) {
        console.error(`Failed to read text from page ${pageNumber}:`, error);
        return "";
      }
    }),
  );
}

export function SplitPdfPageAssigner({
  jobs,
  disabled,
  onAddFiles,
  onSplittingChange,
}: SplitPdfPageAssignerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [assignments, setAssignments] = useState<PageAssignment[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState<number | null>(
    null,
  );

  const isBusy = disabled || isAnalysing || isSplitting;

  const resetSource = () => {
    setSourceFile(null);
    setAssignments([]);
    setIsAnalysing(false);
    setPreviewPageIndex(null);
  };

  const selectSourceFile = ({ file }: { file: File }) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: `${file.name} is not a PDF`,
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_SOURCE_PDF_SIZE) {
      toast({
        title: "File too large",
        description: `${file.name} is larger than 50MB`,
        variant: "destructive",
      });
      return;
    }
    setAssignments([]);
    setPreviewPageIndex(null);
    setIsAnalysing(true);
    setSourceFile(file);
  };

  const handleDocumentLoad = async ({ pdf }: { pdf: PDFDocumentProxy }) => {
    const pageTexts = await extractPageTexts({ pdf });
    setAssignments(suggestPageAssignments({ pageTexts, jobs }));
    setIsAnalysing(false);
  };

  const handleDocumentError = ({ error }: { error: Error }) => {
    console.error("Failed to load PDF for splitting:", error);
    toast({
      title: "Could not read PDF",
      description: "The PDF could not be opened. It may be damaged or protected.",
      variant: "destructive",
    });
    resetSource();
  };

  const updateAssignment = ({
    pageIndex,
    changes,
  }: {
    pageIndex: number;
    changes: Partial<Pick<PageAssignment, "jobId" | "attachmentType">>;
  }) => {
    setAssignments((prev) =>
      prev.map((assignment) =>
        assignment.pageIndex === pageIndex
          ? { ...assignment, ...changes, reason: null }
          : assignment,
      ),
    );
  };

  const groups = groupPageAssignments({ assignments });
  const assignedPageCount = assignments.filter((a) => a.jobId !== null).length;
  const skippedPageCount = assignments.length - assignedPageCount;
  const targetJobCount = new Set(groups.map((group) => group.jobId)).size;
  const sortedJobs = [...jobs].sort((a, b) => a.date.localeCompare(b.date));

  const handleAddToJobs = async () => {
    if (!sourceFile || groups.length === 0) return;
    setIsSplitting(true);
    onSplittingChange({ isSplitting: true });
    try {
      const sourceBytes = await sourceFile.arrayBuffer();
      const files = await splitPdfIntoGroups({
        sourceBytes,
        sourceName: sourceFile.name,
        groups,
      });

      const oversized = files.find(({ file }) => file.size > MAX_FILE_SIZE);
      if (oversized) {
        toast({
          title: "Split file too large",
          description: `${oversized.file.name} is ${formatFileSize({ bytes: oversized.file.size })}, over the 20MB limit. Assign fewer pages to that job.`,
          variant: "destructive",
        });
        return;
      }

      onAddFiles({ files });
      resetSource();
    } catch (error) {
      console.error("Failed to split PDF:", error);
      toast({
        title: "Could not split PDF",
        description:
          error instanceof Error ? error.message : "Failed to split the PDF",
        variant: "destructive",
      });
    } finally {
      setIsSplitting(false);
      onSplittingChange({ isSplitting: false });
    }
  };

  if (!sourceFile) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Upload one PDF containing runsheets and dockets for several jobs.
          Each page is matched to a job for you to confirm, then the pages are
          split into a separate PDF for each job.
        </p>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file && !isBusy) selectSourceFile({ file });
          }}
          onClick={() => {
            if (!isBusy) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isBusy) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Select a PDF to split across jobs"
          id="split-pdf-drop-zone"
        >
          <Scissors className="h-6 w-6 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {isDragOver ? "Drop PDF here" : "Drop a PDF or click to select"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Up to 50MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          id="split-pdf-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) selectSourceFile({ file });
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 space-y-3">
      <div className="flex items-center justify-between gap-2 rounded border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="text-sm truncate">{sourceFile.name}</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
            {formatFileSize({ bytes: sourceFile.size })}
          </Badge>
          {assignments.length > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {assignments.length} page{assignments.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={resetSource}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              resetSource();
            }
          }}
          disabled={isBusy}
          id="split-pdf-change-file-btn"
        >
          Choose another PDF
        </Button>
      </div>

      <Document
        file={sourceFile}
        onLoadSuccess={(pdf) => handleDocumentLoad({ pdf })}
        onLoadError={(error) => handleDocumentError({ error })}
        loading={
          <p className="text-sm text-muted-foreground py-6 text-center">
            Reading PDF...
          </p>
        }
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {assignments.map((assignment) => {
          const pageNumber = assignment.pageIndex + 1;
          const isSkipped = assignment.jobId === null;
          return (
            <div
              key={assignment.pageIndex}
              className={`min-w-0 rounded-lg border p-2 space-y-2 ${
                isSkipped ? "opacity-70 border-dashed" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Page {pageNumber}</span>
                {assignment.reason && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0"
                    title={REASON_LABELS[assignment.reason]}
                  >
                    {assignment.reason === "matched" ? "Matched" : "Suggested"}
                  </Badge>
                )}
              </div>
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded border bg-white"
                onClick={() => setPreviewPageIndex(assignment.pageIndex)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewPageIndex(assignment.pageIndex);
                  }
                }}
                aria-label={`Preview page ${pageNumber}`}
                id={`split-pdf-preview-page-${pageNumber}-btn`}
              >
                <Page
                  pageNumber={pageNumber}
                  width={THUMBNAIL_WIDTH}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="mx-auto flex justify-center"
                />
                <span className="absolute bottom-1 right-1 rounded bg-background/80 p-0.5">
                  <ZoomIn className="h-3.5 w-3.5">
                    <title>Enlarge page</title>
                  </ZoomIn>
                </span>
              </button>
              <Select
                value={
                  assignment.jobId === null
                    ? SKIP_VALUE
                    : String(assignment.jobId)
                }
                onValueChange={(value) =>
                  updateAssignment({
                    pageIndex: assignment.pageIndex,
                    changes: {
                      jobId: value === SKIP_VALUE ? null : Number(value),
                    },
                  })
                }
                disabled={isBusy}
              >
                <SelectTrigger
                  className="h-8 w-full min-w-0 text-xs *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate"
                  id={`split-pdf-page-${pageNumber}-job-select`}
                  aria-label={`Job for page ${pageNumber}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP_VALUE} className="text-xs">
                    Skip this page
                  </SelectItem>
                  {sortedJobs.map((job) => (
                    <SelectItem
                      key={job.id}
                      value={String(job.id)}
                      className="text-xs"
                    >
                      #{job.id} {formatJobLabel({ job })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={assignment.attachmentType}
                onValueChange={(value) =>
                  updateAssignment({
                    pageIndex: assignment.pageIndex,
                    changes: { attachmentType: value as SplitAttachmentType },
                  })
                }
                disabled={isBusy || isSkipped}
              >
                <SelectTrigger
                  className="h-8 w-full min-w-0 text-xs *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate"
                  id={`split-pdf-page-${pageNumber}-type-select`}
                  aria-label={`Attachment type for page ${pageNumber}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_TYPES.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className="text-xs"
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        <Dialog
          open={previewPageIndex !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewPageIndex(null);
          }}
        >
          <DialogContent
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
            id="split-pdf-page-preview-dialog"
          >
            <DialogHeader>
              <DialogTitle>
                Page {previewPageIndex === null ? "" : previewPageIndex + 1}
              </DialogTitle>
            </DialogHeader>
            {previewPageIndex !== null && (
              <Page
                pageNumber={previewPageIndex + 1}
                width={PREVIEW_WIDTH}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="mx-auto flex justify-center"
              />
            )}
          </DialogContent>
        </Dialog>
      </Document>

      {isAnalysing && (
        <p className="text-xs text-muted-foreground">Matching pages to jobs...</p>
      )}

      {assignments.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {assignedPageCount} page{assignedPageCount === 1 ? "" : "s"} to{" "}
            {targetJobCount} job{targetJobCount === 1 ? "" : "s"}
            {skippedPageCount > 0 && `, ${skippedPageCount} skipped`}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleAddToJobs}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAddToJobs();
              }
            }}
            disabled={isBusy || groups.length === 0}
            id="split-pdf-add-to-jobs-btn"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isSplitting ? "Splitting..." : "Add pages to jobs"}
          </Button>
        </div>
      )}
    </div>
  );
}

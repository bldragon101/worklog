"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driveFileQuery } from "@/lib/queries";
import {
  extractFileIdFromUrl,
  extractFilenameFromUrl,
} from "@/lib/utils/file-utils";
import type { Job } from "@/lib/types";

/** Loaded on the client only to avoid SSR issues with PDF.js */
const JobRunsheetPdf = dynamic(
  () =>
    import("@/components/entities/job/job-runsheet-pdf").then((mod) => ({
      default: mod.JobRunsheetPdf,
    })),
  { ssr: false, loading: () => <RunsheetLoading label="Loading viewer..." /> },
);

const PREFETCH_CONCURRENCY = 3;

/**
 * Downloads the runsheets of the given jobs in the background, a few at a time
 * and in display order, so expanding a job row shows its runsheet from the
 * cache. Failed downloads are not retried here; expanding the row retries.
 * Downloads for jobs that are no longer given are cancelled, so changing pages
 * does not leave earlier downloads running beside the new ones.
 */
export function JobRunsheetPrefetcher({ jobs }: { jobs: Job[] }) {
  const queryClient = useQueryClient();
  const fileIds = [
    ...new Set(
      jobs.flatMap((job) =>
        (job.attachmentRunsheet ?? []).flatMap((url) => {
          const fileId = extractFileIdFromUrl(url);
          return fileId ? [fileId] : [];
        }),
      ),
    ),
  ];

  let availableSlots = PREFETCH_CONCURRENCY;
  const queries = fileIds.map((fileId) => {
    const options = driveFileQuery({ fileId });
    const status = queryClient.getQueryState(options.queryKey)?.status;
    const takesSlot = status === "pending" || status === undefined;
    const isEnabled = takesSlot && availableSlots > 0;
    if (isEnabled) availableSlots -= 1;
    return { ...options, enabled: isEnabled };
  });

  useQueries({ queries });

  return null;
}

/**
 * Inline preview of every runsheet attached to a job, shown when a job row is
 * expanded in runsheet preview mode.
 */
export function JobRunsheetPreview({ job }: { job: Job }) {
  const runsheets = job.attachmentRunsheet ?? [];

  if (runsheets.length === 0) {
    return (
      <div
        className="sticky left-0 flex w-fit items-center gap-2 px-4 py-6 text-sm text-muted-foreground"
        id={`job-runsheet-preview-${job.id}`}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        No runsheet attached to this job
      </div>
    );
  }

  return (
    <div
      className="sticky left-0 flex w-fit max-w-full flex-col gap-6 p-4"
      id={`job-runsheet-preview-${job.id}`}
    >
      {runsheets.map((url, index) => (
        <RunsheetAttachment
          key={url}
          url={url}
          jobId={job.id}
          index={index}
        />
      ))}
    </div>
  );
}

function RunsheetAttachment({
  url,
  jobId,
  index,
}: {
  url: string;
  jobId: number;
  index: number;
}) {
  const fileId = extractFileIdFromUrl(url);
  const fileName = extractFilenameFromUrl(url) ?? `Runsheet ${index + 1}`;
  const viewUrl = fileId
    ? `https://drive.google.com/file/d/${fileId}/view`
    : url;

  const fileQuery = useQuery({
    ...driveFileQuery({ fileId: fileId ?? "" }),
    enabled: fileId !== null,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText
            className="h-4 w-4 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <span className="truncate text-sm font-medium" title={fileName}>
            {fileName}
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="h-7 shrink-0">
          <a
            id={`open-runsheet-in-drive-${jobId}-${index}`}
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Cloud className="mr-1 h-4 w-4" aria-hidden="true" />
            Open in Drive
          </a>
        </Button>
      </div>
      <RunsheetContent
        fileId={fileId}
        fileName={fileName}
        fileUrl={fileQuery.data}
        isLoading={fileQuery.isLoading}
        isError={fileQuery.isError}
      />
    </div>
  );
}

function RunsheetContent({
  fileId,
  fileName,
  fileUrl,
  isLoading,
  isError,
}: {
  fileId: string | null;
  fileName: string;
  fileUrl: string | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (!fileId) {
    return (
      <p className="text-sm text-muted-foreground">
        This attachment cannot be previewed. Open it in Google Drive instead.
      </p>
    );
  }

  if (isLoading) {
    return <RunsheetLoading label="Loading runsheet..." />;
  }

  if (isError || !fileUrl) {
    return (
      <p className="text-sm text-destructive">
        Failed to load the runsheet from Google Drive
      </p>
    );
  }

  if (fileUrl.startsWith("data:image/")) {
    return (
      <Image
        src={fileUrl}
        alt={fileName}
        width={800}
        height={1131}
        unoptimized
        className="h-auto max-w-full rounded border bg-white shadow-sm"
      />
    );
  }

  return <JobRunsheetPdf fileUrl={fileUrl} />;
}

function RunsheetLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
      {label}
    </div>
  );
}

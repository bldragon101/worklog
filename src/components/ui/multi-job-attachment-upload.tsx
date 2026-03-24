"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import type { Job } from "@/lib/types";

interface MultiJobAttachmentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  baseFolderId: string;
  driveId: string;
  onUploadSuccess: (updatedJobs: Job[]) => void;
}

interface JobFile {
  id: string;
  file: File;
  attachmentType: string;
}

interface JobUploadStatus {
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
}

export const ATTACHMENT_TYPES = [
  { value: "runsheet", label: "Runsheet" },
  { value: "docket", label: "Docket" },
  { value: "delivery_photos", label: "Delivery Photos" },
];

export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/plain": [".txt"],
};

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function formatJobLabel({ job }: { job: Job }): string {
  const dateStr =
    job.date.slice(8, 10) +
    "/" +
    job.date.slice(5, 7) +
    "/" +
    job.date.slice(2, 4);
  return `${dateStr} - ${job.driver} - ${job.customer}`;
}

export function generateFileId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function formatFileSize({ bytes }: { bytes: number }): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon({ file }: { file: File }) {
  if (file.type.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-gray-500 shrink-0" />;
}

export function isValidFileType({ file }: { file: File }): boolean {
  return Object.keys(ACCEPTED_FILE_TYPES).some((mimeType) => {
    if (mimeType.endsWith("/*")) {
      return file.type.startsWith(mimeType.replace("/*", "/"));
    }
    return file.type === mimeType;
  });
}

export function MultiJobAttachmentUpload({
  isOpen,
  onClose,
  jobs,
  baseFolderId,
  driveId,
  onUploadSuccess,
}: MultiJobAttachmentUploadProps) {
  const { toast } = useToast();
  const [filesByJob, setFilesByJob] = useState<Record<number, JobFile[]>>({});
  const [dragOverJobId, setDragOverJobId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<
    Record<number, JobUploadStatus>
  >({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const resetState = () => {
    setFilesByJob({});
    setDragOverJobId(null);
    setIsUploading(false);
    setJobStatuses({});
  };

  const handleClose = () => {
    if (!isUploading) {
      resetState();
      onClose();
    }
  };

  const validateAndAddFiles = ({
    jobId,
    newFiles,
  }: {
    jobId: number;
    newFiles: FileList | File[];
  }) => {
    const fileArray = Array.from(newFiles);
    const validFiles: JobFile[] = [];

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 20MB`,
          variant: "destructive",
        });
        continue;
      }

      if (!isValidFileType({ file })) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push({
        id: generateFileId(),
        file,
        attachmentType: "runsheet",
      });
    }

    if (validFiles.length > 0) {
      setFilesByJob((prev) => ({
        ...prev,
        [jobId]: [...(prev[jobId] || []), ...validFiles],
      }));
    }
  };

  const handleJobDragOver = ({
    e,
    jobId,
  }: {
    e: React.DragEvent;
    jobId: number;
  }) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverJobId(jobId);
  };

  const handleJobDragLeave = ({ e }: { e: React.DragEvent }) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverJobId(null);
    }
  };

  const handleJobDrop = ({
    e,
    jobId,
  }: {
    e: React.DragEvent;
    jobId: number;
  }) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverJobId(null);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      validateAndAddFiles({ jobId, newFiles: droppedFiles });
    }
  };

  const handleFileInputChange = ({
    e,
    jobId,
  }: {
    e: React.ChangeEvent<HTMLInputElement>;
    jobId: number;
  }) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles({ jobId, newFiles: e.target.files });
      e.target.value = "";
    }
  };

  const removeFile = ({ jobId, fileId }: { jobId: number; fileId: string }) => {
    if (isUploading) return;
    setFilesByJob((prev) => {
      const updated = { ...prev };
      const jobFiles = updated[jobId];
      if (!jobFiles) return prev;
      const filtered = jobFiles.filter((f) => f.id !== fileId);
      if (filtered.length === 0) {
        const { [jobId]: _, ...rest } = updated;
        return rest;
      }
      updated[jobId] = filtered;
      return updated;
    });
  };

  const updateFileAttachmentType = ({
    jobId,
    fileId,
    attachmentType,
  }: {
    jobId: number;
    fileId: string;
    attachmentType: string;
  }) => {
    setFilesByJob((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] || []).map((f) =>
        f.id === fileId ? { ...f, attachmentType } : f,
      ),
    }));
  };

  const totalFileCount = Object.values(filesByJob).reduce(
    (sum, files) => sum + files.length,
    0,
  );

  const jobsWithFiles = Object.keys(filesByJob).filter(
    (jobId) => (filesByJob[Number(jobId)]?.length || 0) > 0,
  );

  const canUpload = totalFileCount > 0 && !isUploading;

  const uploadJob = async ({
    jobId,
  }: {
    jobId: number;
  }): Promise<{ jobId: number; job?: Job; error?: string }> => {
    const jobFiles = filesByJob[jobId];
    if (!jobFiles || jobFiles.length === 0) {
      return { jobId, error: "No files" };
    }

    try {
      const formData = new FormData();

      for (const [index, jf] of jobFiles.entries()) {
        formData.append("files", jf.file);
        formData.append(`attachmentTypes[${index}]`, jf.attachmentType);
      }

      formData.append("baseFolderId", baseFolderId);
      formData.append("driveId", driveId);

      const response = await fetch(`/api/jobs/${jobId}/attachments`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return { jobId, job: result.job };
      }
      return { jobId, error: result.error || "Upload failed" };
    } catch (error) {
      console.error(`Upload error for job ${jobId}:`, error);
      return { jobId, error: "Network error" };
    }
  };

  const uploadAllFiles = async () => {
    if (totalFileCount === 0) {
      toast({
        title: "No files selected",
        description: "Please add at least one file to a job before uploading",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    const jobIdsToUpload = Object.keys(filesByJob)
      .map(Number)
      .filter((jobId) => (filesByJob[jobId]?.length || 0) > 0);

    const initialStatuses: Record<number, JobUploadStatus> = {};
    for (const jobId of jobIdsToUpload) {
      initialStatuses[jobId] = { status: "uploading" };
    }
    setJobStatuses(initialStatuses);

    const results = await Promise.allSettled(
      jobIdsToUpload.map((jobId) => uploadJob({ jobId })),
    );

    const updatedJobs: Job[] = [];
    const succeededJobIds: number[] = [];
    const newStatuses: Record<number, JobUploadStatus> = {};

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { jobId, job, error } = result.value;
        if (job) {
          updatedJobs.push(job);
          succeededJobIds.push(jobId);
          newStatuses[jobId] = { status: "success" };
        } else {
          newStatuses[jobId] = {
            status: "error",
            error: error || "Upload failed",
          };
        }
      } else {
        console.error("Unexpected rejection in upload:", result.reason);
      }
    }

    setJobStatuses((prev) => ({ ...prev, ...newStatuses }));

    if (succeededJobIds.length > 0) {
      setFilesByJob((prev) => {
        const next = { ...prev };
        for (const jobId of succeededJobIds) {
          delete (next as Record<number, JobFile[] | undefined>)[jobId];
        }
        return next;
      });
    }

    setIsUploading(false);

    if (updatedJobs.length > 0) {
      onUploadSuccess(updatedJobs);

      const failedCount = jobIdsToUpload.length - updatedJobs.length;
      if (failedCount === 0) {
        toast({
          title: "Upload successful",
          description: `Files uploaded to ${updatedJobs.length} job(s)`,
          variant: "default",
        });
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        toast({
          title: "Partial upload",
          description: `Files uploaded to ${updatedJobs.length} job(s), but ${failedCount} job(s) failed`,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Upload failed",
        description: "Failed to upload files to any of the selected jobs",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className="max-w-3xl max-h-[85vh] flex flex-col"
          id="multi-job-attachment-upload-dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" aria-hidden="true" />
              Upload Attachments - {jobs.length} Job
              {jobs.length === 1 ? "" : "s"} Selected
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground">
              Drag and drop files into each job, or click the upload area to
              select files.
            </p>

            {jobs.map((job) => {
              const jobFiles = filesByJob[job.id] || [];
              const isDragTarget = dragOverJobId === job.id;
              const status = jobStatuses[job.id];

              return (
                <div
                  key={job.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    isDragTarget
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border"
                  } ${
                    status?.status === "success"
                      ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                      : status?.status === "error"
                        ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800"
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono shrink-0"
                      >
                        #{job.id}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {formatJobLabel({ job })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {jobFiles.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {jobFiles.length} file
                          {jobFiles.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {status?.status === "uploading" && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      )}
                      {status?.status === "success" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {status?.status === "error" && (
                        <AlertCircle
                          className="h-4 w-4 text-red-500"
                          aria-label={status.error || "Upload error"}
                        />
                      )}
                    </div>
                  </div>

                  {status?.status === "error" && status.error && (
                    <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {status.error}
                      </p>
                    </div>
                  )}

                  <div className="p-2 space-y-2">
                    {status?.status !== "success" && !isUploading && (
                      <div
                        className={`border-2 border-dashed rounded p-3 text-center transition-colors ${
                          isDragTarget
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        } cursor-pointer`}
                        onDragOver={(e) =>
                          handleJobDragOver({ e, jobId: job.id })
                        }
                        onDragLeave={(e) => handleJobDragLeave({ e })}
                        onDrop={(e) => handleJobDrop({ e, jobId: job.id })}
                        onClick={() => fileInputRefs.current[job.id]?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRefs.current[job.id]?.click();
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Drop files here for job ${job.id}`}
                        id={`job-drop-zone-${job.id}`}
                      >
                        <Upload className="h-5 w-5 mx-auto mb-1 text-gray-400" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {isDragTarget
                            ? "Drop files here"
                            : "Drop files or click to select"}
                        </p>
                      </div>
                    )}

                    {jobFiles.length > 0 && (
                      <div className="space-y-1.5">
                        {jobFiles.map((jf) => (
                          <div
                            key={jf.id}
                            className="flex items-center gap-2 p-2 rounded border bg-background"
                          >
                            {getFileIcon({ file: jf.file })}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs truncate">
                                  {jf.file.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 shrink-0"
                                >
                                  {formatFileSize({ bytes: jf.file.size })}
                                </Badge>
                              </div>
                            </div>
                            <Select
                              value={jf.attachmentType}
                              onValueChange={(value) =>
                                updateFileAttachmentType({
                                  jobId: job.id,
                                  fileId: jf.id,
                                  attachmentType: value,
                                })
                              }
                              disabled={
                                isUploading || status?.status === "success"
                              }
                            >
                              <SelectTrigger
                                className="h-7 text-xs w-[130px] shrink-0"
                                id={`multi-type-${job.id}-${jf.id}`}
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
                            {!isUploading && status?.status !== "success" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  removeFile({ jobId: job.id, fileId: jf.id })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    removeFile({
                                      jobId: job.id,
                                      fileId: jf.id,
                                    });
                                  }
                                }}
                                className="h-6 w-6 p-0 shrink-0"
                                aria-label={`Remove ${jf.file.name}`}
                                id={`multi-remove-${job.id}-${jf.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              {totalFileCount > 0 ? (
                <span>
                  {totalFileCount} file{totalFileCount === 1 ? "" : "s"} across{" "}
                  {jobsWithFiles.length} job
                  {jobsWithFiles.length === 1 ? "" : "s"}
                </span>
              ) : (
                <span>No files added yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                id="multi-cancel-upload-btn"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={uploadAllFiles}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    uploadAllFiles();
                  }
                }}
                disabled={!canUpload}
                id="multi-upload-files-btn"
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {totalFileCount > 0 ? `${totalFileCount} ` : ""}File
                    {totalFileCount === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {jobs.map((job) => (
        <input
          key={job.id}
          ref={(el) => {
            fileInputRefs.current[job.id] = el;
          }}
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_FILE_TYPES).join(",")}
          onChange={(e) => handleFileInputChange({ e, jobId: job.id })}
          className="hidden"
          id={`multi-hidden-file-input-${job.id}`}
        />
      ))}
    </>
  );
}

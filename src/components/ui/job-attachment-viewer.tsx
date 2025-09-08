"use client";

import React, { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import dynamic from "next/dynamic";
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { extractFileIdFromUrl, extractFilenameFromUrl } from "@/lib/file-utils";

// Dynamically import FileViewer to avoid SSR issues with PDF.js
const FileViewer = dynamic(
  () =>
    import("@/components/ui/file-viewer").then((mod) => ({
      default: mod.FileViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-8 w-8 animate-spin rounded border-2 border-primary border-t-transparent" />
    ),
  },
);

interface JobAttachmentViewerProps {
  attachments: {
    runsheet: string[];
    docket: string[];
    delivery_photos: string[];
  };
  jobId: number;
  onAttachmentDeleted?: () => void; // Callback to refresh data after deletion
  driveId?: string; // Optional drive ID for shared drives
}

export function JobAttachmentViewer({
  attachments,
  jobId,
  onAttachmentDeleted,
  driveId,
}: JobAttachmentViewerProps) {
  const [error, setError] = useState<string>("");
  const [deletingAttachment, setDeletingAttachment] = useState<string | null>(
    null,
  );

  // Collect all attachment URLs (memoized to prevent unnecessary re-renders)
  const allUrls = React.useMemo(
    () => [
      ...attachments.runsheet,
      ...attachments.docket,
      ...attachments.delivery_photos,
    ],
    [attachments.runsheet, attachments.docket, attachments.delivery_photos],
  );

  // Simplified metadata handling without React Query

  // Get filename for a file ID
  const getFileName = useCallback(
    (fileId: string): string => {
      // Try to get from URL parameters
      const url = allUrls.find((url) => extractFileIdFromUrl(url) === fileId);
      if (url) {
        const urlFilename = extractFilenameFromUrl(url);
        if (urlFilename) {
          return urlFilename;
        }
      }

      return `Attachment ${fileId.substring(0, 8)}...`;
    },
    [allUrls],
  );

  // Display the full organized filename
  const getDisplayName = (fileName: string): string => {
    // If it's a fallback name (starts with "Attachment"), return as is
    if (fileName.startsWith("Attachment ")) {
      return fileName;
    }

    // Return the full organized filename as-is, just truncate if too long
    if (fileName.length > 50) {
      const extensionMatch = fileName.match(/^(.+)(\.[^.]+)$/);
      if (extensionMatch) {
        const [, namePart, extension] = extensionMatch;
        return `${namePart.substring(0, 45)}...${extension}`;
      }
      return `${fileName.substring(0, 47)}...`;
    }

    return fileName;
  };

  // Convert Google Drive URLs to file objects for the FileViewer
  const parseGoogleDriveUrl = useCallback(
    (url: string): { id: string; name: string } | null => {
      try {
        const fileId = extractFileIdFromUrl(url);
        if (fileId) {
          const fileName = getFileName(fileId);
          return { id: fileId, name: fileName };
        }
        return null;
      } catch (error) {
        console.error("Error parsing Google Drive URL:", error);
        return null;
      }
    },
    [getFileName],
  );

  const getFileUrl = useCallback(async (fileId: string): Promise<string> => {
    try {
      const response = await fetch(
        `/api/google-drive/get-file?fileId=${fileId}`,
      );
      const result = await response.json();

      if (response.ok && result.success) {
        return result.fileUrl || result.imageUrl;
      } else {
        throw new Error(result.error || "Failed to get file URL");
      }
    } catch (error) {
      console.error("Failed to get file URL:", error);
      setError("Failed to load file from Google Drive");
      throw error;
    }
  }, []);

  // Metadata loading errors handling removed

  const handleViewInDrive = useCallback((fileId: string) => {
    const viewerUrl = `https://drive.google.com/file/d/${fileId}/view`;
    window.open(viewerUrl, "_blank");
  }, []);

  const handleDeleteAttachment = useCallback(
    async (fileUrl: string, attachmentType: string) => {
      try {
        setDeletingAttachment(fileUrl);
        setError("");

        const response = await fetch(`/api/jobs/${jobId}/attachments`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileUrl,
            attachmentType,
            ...(driveId && { driveId }),
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Show appropriate message based on deletion type
          if (result.partialDeletion) {
            // This was a partial deletion (database only)
            setError(`⚠️ ${result.message}`);
          }

          // Call the callback to refresh data
          if (onAttachmentDeleted) {
            onAttachmentDeleted();
          }
        } else {
          setError(result.error || "Failed to delete attachment");
        }
      } catch (error) {
        console.error("Failed to delete attachment:", error);
        setError("Failed to delete attachment. Please try again.");
      } finally {
        setDeletingAttachment(null);
      }
    },
    [jobId, onAttachmentDeleted, driveId],
  );

  const renderAttachmentSection = (
    title: string,
    urls: string[],
    type: string,
  ) => {
    if (urls.length === 0) return null;

    return (
      <div key={type} className="w-full space-y-2">
        <div className="w-full flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{title}</h4>
          <Badge variant="secondary" className="text-xs">
            {urls.length}
          </Badge>
        </div>
        <div className="w-full space-y-1">
          {urls.map((url, index) => {
            const parsedFile = parseGoogleDriveUrl(url);
            if (!parsedFile) {
              return (
                <div key={index} className="w-full p-2 border rounded text-sm">
                  <div className="flex items-center gap-2 w-full">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="flex-1">Invalid attachment URL</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(url, "_blank")}
                        className="h-6 w-6 p-0"
                        id={`view-external-${jobId}-${type}-${index}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingAttachment === url}
                            id={`delete-invalid-attachment-${jobId}-${type}-${index}`}
                          >
                            {deletingAttachment === url ? (
                              <div className="h-3 w-3 animate-spin rounded border border-destructive border-t-transparent" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent
                          id={`delete-invalid-confirmation-modal-${jobId}-${type}-${index}`}
                        >
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Attachment
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this invalid
                              attachment URL? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              id={`cancel-delete-invalid-${jobId}-${type}-${index}`}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAttachment(url, type)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              id={`confirm-delete-invalid-${jobId}-${type}-${index}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            }

            // Determine file type based on extension or URL
            const isImage = parsedFile.name.match(
              /\.(jpg|jpeg|png|gif|webp)$/i,
            );
            const isPdf = parsedFile.name.match(/\.pdf$/i);

            // Create a file-like object for the FileViewer
            const fileObject = {
              id: parsedFile.id,
              name: parsedFile.name,
              mimeType: isImage
                ? "image/jpeg"
                : isPdf
                  ? "application/pdf"
                  : "application/octet-stream",
              createdTime: new Date().toISOString(),
              isFolder: false,
            };

            return (
              <div key={index} className="w-full p-2 border rounded">
                <div className="flex items-center gap-2 w-full">
                  {isImage ? (
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  ) : isPdf ? (
                    <FileText className="h-4 w-4 text-red-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-500" />
                  )}
                  <span
                    className="flex-1 text-sm truncate"
                    title={parsedFile.name}
                  >
                    {getDisplayName(parsedFile.name)}
                  </span>
                  <div className="flex items-center gap-1">
                    <FileViewer
                      file={fileObject}
                      onViewInDrive={handleViewInDrive}
                      getFileUrl={getFileUrl}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingAttachment === url}
                          id={`delete-attachment-${jobId}-${type}-${index}`}
                        >
                          {deletingAttachment === url ? (
                            <div className="h-3 w-3 animate-spin rounded border border-destructive border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent
                        id={`delete-confirmation-modal-${jobId}-${type}-${index}`}
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &ldquo;
                            {getDisplayName(parsedFile.name)}&rdquo;? This
                            action cannot be undone and will permanently remove
                            the file from Google Drive.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            id={`cancel-delete-${jobId}-${type}-${index}`}
                          >
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAttachment(url, type)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            id={`confirm-delete-${jobId}-${type}-${index}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const totalAttachments =
    attachments.runsheet.length +
    attachments.docket.length +
    attachments.delivery_photos.length;

  if (totalAttachments === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No attachments for this job</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" id={`job-attachments-${jobId}`}>
      {error && (
        <div
          className={`w-full text-sm p-2 rounded ${
            error.startsWith("⚠️")
              ? "text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300"
              : "text-red-600 bg-red-50 dark:bg-red-950"
          }`}
        >
          {error}
        </div>
      )}

      {/* Metadata loading indicator removed */}

      {renderAttachmentSection("Runsheet", attachments.runsheet, "runsheet")}
      {renderAttachmentSection("Docket", attachments.docket, "docket")}
      {renderAttachmentSection(
        "Delivery Photos",
        attachments.delivery_photos,
        "delivery_photos",
      )}
    </div>
  );
}

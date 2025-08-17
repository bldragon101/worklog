"use client"

import React, { useState, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';
import { 
  FileText, 
  Image as ImageIcon,
  Paperclip,
  ExternalLink
} from "lucide-react";
import { useAttachmentMetadata, extractFileIdFromUrl, extractFilenameFromUrl } from '@/hooks/use-file-metadata';

// Dynamically import FileViewer to avoid SSR issues with PDF.js
const FileViewer = dynamic(() => import("@/components/ui/file-viewer").then(mod => ({ default: mod.FileViewer })), {
  ssr: false,
  loading: () => <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
});

interface JobAttachmentViewerProps {
  attachments: {
    runsheet: string[];
    docket: string[];
    delivery_photos: string[];
  };
  jobId: number;
}

export function JobAttachmentViewer({ attachments, jobId }: JobAttachmentViewerProps) {
  const [error, setError] = useState<string>('');
  
  // Collect all attachment URLs (memoized to prevent unnecessary re-renders)
  const allUrls = React.useMemo(() => [
    ...attachments.runsheet,
    ...attachments.docket,
    ...attachments.delivery_photos
  ], [attachments.runsheet, attachments.docket, attachments.delivery_photos]);
  
  // Use React Query hook for batch metadata fetching
  const {
    data: metadataMap,
    isLoading: isLoadingMetadata,
    error: metadataError
  } = useAttachmentMetadata(allUrls, {
    enabled: allUrls.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Get filename for a file ID with React Query cache
  const getFileName = useCallback((fileId: string): string => {
    // First try to get from URL parameters
    const url = allUrls.find(url => extractFileIdFromUrl(url) === fileId);
    if (url) {
      const urlFilename = extractFilenameFromUrl(url);
      if (urlFilename) {
        return urlFilename;
      }
    }
    
    // Then check React Query cache
    const metadata = metadataMap?.[fileId];
    if (metadata?.fileName) {
      return metadata.fileName;
    }
    
    // Loading or error fallback
    if (isLoadingMetadata) {
      return 'Loading...';
    }
    
    return `Attachment ${fileId.substring(0, 8)}...`;
  }, [allUrls, metadataMap, isLoadingMetadata]);

  // Display the full organized filename
  const getDisplayName = (fileName: string): string => {
    // If it's a fallback name (starts with "Attachment"), return as is
    if (fileName.startsWith('Attachment ')) {
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
  const parseGoogleDriveUrl = useCallback((url: string): { id: string; name: string } | null => {
    try {
      const fileId = extractFileIdFromUrl(url);
      if (fileId) {
        const fileName = getFileName(fileId);
        return { id: fileId, name: fileName };
      }
      return null;
    } catch (error) {
      console.error('Error parsing Google Drive URL:', error);
      return null;
    }
  }, [getFileName]);

  const getFileUrl = useCallback(async (fileId: string): Promise<string> => {
    try {
      const response = await fetch(`/api/google-drive/get-file?fileId=${fileId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        return result.fileUrl || result.imageUrl;
      } else {
        throw new Error(result.error || 'Failed to get file URL');
      }
    } catch (error) {
      console.error('Failed to get file URL:', error);
      setError('Failed to load file from Google Drive');
      throw error;
    }
  }, []);

  // Handle metadata loading errors
  React.useEffect(() => {
    if (metadataError) {
      setError('Failed to load some attachment metadata. File names may not display correctly.');
    }
  }, [metadataError]);

  const handleViewInDrive = useCallback((fileId: string) => {
    const viewerUrl = `https://drive.google.com/file/d/${fileId}/view`;
    window.open(viewerUrl, '_blank');
  }, []);

  const renderAttachmentSection = (title: string, urls: string[], type: string) => {
    if (urls.length === 0) return null;

    return (
      <div key={type} className="space-y-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{title}</h4>
          <Badge variant="secondary" className="text-xs">
            {urls.length}
          </Badge>
        </div>
        <div className="space-y-1">
          {urls.map((url, index) => {
            const parsedFile = parseGoogleDriveUrl(url);
            if (!parsedFile) {
              return (
                <div key={index} className="flex items-center gap-2 p-2 border rounded text-sm">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="flex-1">Invalid attachment URL</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(url, '_blank')}
                    className="h-6 w-6 p-0"
                    id={`view-external-${jobId}-${type}-${index}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              );
            }

            // Determine file type based on extension or URL
            const isImage = parsedFile.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            const isPdf = parsedFile.name.match(/\.pdf$/i);

            // Create a file-like object for the FileViewer
            const fileObject = {
              id: parsedFile.id,
              name: parsedFile.name,
              mimeType: isImage ? 'image/jpeg' : isPdf ? 'application/pdf' : 'application/octet-stream',
              createdTime: new Date().toISOString(),
              isFolder: false
            };

            return (
              <div key={index} className="flex items-center gap-2 p-2 border rounded">
                {isImage ? (
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                ) : isPdf ? (
                  <FileText className="h-4 w-4 text-red-500" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-500" />
                )}
                <span className="flex-1 text-sm truncate" title={parsedFile.name}>
                  {getDisplayName(parsedFile.name)}
                </span>
                <FileViewer
                  file={fileObject}
                  onViewInDrive={handleViewInDrive}
                  getFileUrl={getFileUrl}
                />
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
    <div className="space-y-4" id={`job-attachments-${jobId}`}>
      {error && (
        <div className="text-red-600 text-sm p-2 bg-red-50 dark:bg-red-950 rounded">
          {error}
        </div>
      )}
      
      {isLoadingMetadata && allUrls.length > 0 && (
        <div className="text-muted-foreground text-sm p-2 bg-muted/50 rounded flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading attachment information...
        </div>
      )}
      
      {renderAttachmentSection('Runsheet', attachments.runsheet, 'runsheet')}
      {renderAttachmentSection('Docket', attachments.docket, 'docket')}
      {renderAttachmentSection('Delivery Photos', attachments.delivery_photos, 'delivery_photos')}
    </div>
  );
}
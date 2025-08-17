"use client"

import React, { useState, useCallback, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';
import { 
  FileText, 
  Image as ImageIcon,
  Paperclip,
  ExternalLink
} from "lucide-react";

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
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  // Fetch file metadata to get the actual filename
  const fetchFileName = useCallback(async (fileId: string): Promise<string> => {
    // Check if we already have the filename cached
    if (fileNames[fileId]) {
      return fileNames[fileId];
    }

    try {
      const response = await fetch(`/api/google-drive/get-metadata?fileId=${fileId}`);
      const result = await response.json();
      
      if (response.ok && result.success && result.fileName) {
        const fileName = result.fileName;
        // Cache the filename
        setFileNames(prev => ({ ...prev, [fileId]: fileName }));
        return fileName;
      } else {
        throw new Error(result.error || 'Failed to get file metadata');
      }
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return `Attachment ${fileId.substring(0, 8)}...`;
    }
  }, [fileNames]);

  // Create a more user-friendly display name from the full filename
  const getDisplayName = (fileName: string): string => {
    // If it's a fallback name (starts with "Attachment"), return as is
    if (fileName.startsWith('Attachment ')) {
      return fileName;
    }
    
    // New format: "DD.MM_attachmenttype_originalname.ext"
    // Extract the original filename from the organized format
    const match = fileName.match(/^\d{2}\.\d{2}_[^_]+_(.+)$/);
    if (match) {
      const originalPart = match[1];
      
      // If the name is very long, truncate it but keep the extension
      if (originalPart.length > 30) {
        const extensionMatch = originalPart.match(/^(.+)(\.[^.]+)$/);
        if (extensionMatch) {
          const [, namePart, extension] = extensionMatch;
          return `${namePart.substring(0, 25)}...${extension}`;
        }
        return `${originalPart.substring(0, 27)}...`;
      }
      
      return originalPart;
    }
    
    // Fallback for older format or unexpected names
    const cleanName = fileName.split('/').pop() || fileName;
    
    // If the name is very long, truncate it but keep the extension
    if (cleanName.length > 30) {
      const extensionMatch = cleanName.match(/^(.+)(\.[^.]+)$/);
      if (extensionMatch) {
        const [, namePart, extension] = extensionMatch;
        return `${namePart.substring(0, 25)}...${extension}`;
      }
      return `${cleanName.substring(0, 27)}...`;
    }
    
    return cleanName;
  };

  // Convert Google Drive URLs to file objects for the FileViewer
  const parseGoogleDriveUrl = useCallback((url: string): { id: string; name: string } | null => {
    try {
      // Extract file ID from Google Drive URL
      const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)\/view/);
      if (match) {
        const fileId = match[1];
        
        // Try to extract filename from URL parameter
        try {
          const urlObj = new URL(url);
          const filename = urlObj.searchParams.get('filename');
          if (filename) {
            return { id: fileId, name: decodeURIComponent(filename) };
          }
        } catch {
          // If URL parsing fails, continue with cached name or fallback
        }
        
        // Check if we have the filename cached from API call
        if (fileNames[fileId]) {
          return { id: fileId, name: fileNames[fileId] };
        }
        
        // Fallback: use generic name that will be updated by async fetch
        return { id: fileId, name: `Loading...` };
      }
      return null;
    } catch (error) {
      console.error('Error parsing Google Drive URL:', error);
      return null;
    }
  }, [fileNames]);

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

  // Fetch filenames for all attachments when component mounts
  useEffect(() => {
    const fetchAllFileNames = async () => {
      const allUrls = [
        ...attachments.runsheet,
        ...attachments.docket,
        ...attachments.delivery_photos
      ];

      for (const url of allUrls) {
        const parsedFile = parseGoogleDriveUrl(url);
        if (parsedFile && parsedFile.name === 'Loading...') {
          // This file doesn't have filename in URL, fetch it
          await fetchFileName(parsedFile.id);
        }
      }
    };

    const allUrls = [
      ...attachments.runsheet,
      ...attachments.docket,
      ...attachments.delivery_photos
    ];

    if (allUrls.length > 0) {
      fetchAllFileNames();
    }
  }, [attachments, fetchFileName, parseGoogleDriveUrl]);

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
      
      {renderAttachmentSection('Runsheet', attachments.runsheet, 'runsheet')}
      {renderAttachmentSection('Docket', attachments.docket, 'docket')}
      {renderAttachmentSection('Delivery Photos', attachments.delivery_photos, 'delivery_photos')}
    </div>
  );
}
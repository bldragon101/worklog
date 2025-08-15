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

  // Convert Google Drive URLs to file objects for the FileViewer
  const parseGoogleDriveUrl = (url: string): { id: string; name: string } | null => {
    try {
      // Extract file ID from Google Drive URL
      const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)\/view/);
      if (match) {
        const fileId = match[1];
        // Try to extract filename from URL or use a default
        const urlParts = url.split('/');
        const name = urlParts[urlParts.length - 1] || `attachment-${fileId}`;
        return { id: fileId, name };
      }
      return null;
    } catch (error) {
      console.error('Error parsing Google Drive URL:', error);
      return null;
    }
  };

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
                <span className="flex-1 text-sm truncate">{parsedFile.name}</span>
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
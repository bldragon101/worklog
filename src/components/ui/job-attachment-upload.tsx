"use client"

import React, { useState, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  X, 
  FileText, 
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Paperclip
} from "lucide-react";
import { Job } from "@/lib/types";

interface JobAttachmentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  baseFolderId: string;
  driveId: string;
  onUploadSuccess: (job: Job) => void;
}

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  attachmentType?: string;
}

const ATTACHMENT_TYPES = [
  { value: 'runsheet', label: 'Runsheet' },
  { value: 'docket', label: 'Docket' },
  { value: 'delivery_photos', label: 'Delivery Photos' }
];

const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt']
};

export function JobAttachmentUpload({
  isOpen,
  onClose,
  job,
  baseFolderId,
  driveId,
  onUploadSuccess
}: JobAttachmentUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFiles([]);
    setIsDragOver(false);
    setIsUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!isUploading) {
      resetState();
      onClose();
    }
  }, [isUploading, resetState, onClose]);

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter(file => {
      // Check file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 20MB`,
          variant: "destructive"
        });
        return false;
      }

      // Check file type
      const isValidType = Object.keys(ACCEPTED_FILE_TYPES).some(mimeType => {
        if (mimeType.endsWith('/*')) {
          return file.type.startsWith(mimeType.replace('/*', '/'));
        }
        return file.type === mimeType;
      });

      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive"
        });
        return false;
      }

      return true;
    });

    const uploadFiles: UploadFile[] = validFiles.map(file => ({
      id: generateFileId(),
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, [addFiles]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Clear the input so the same file can be selected again
      e.target.value = '';
    }
  }, [addFiles]);

  const removeFile = useCallback((fileId: string) => {
    if (!isUploading) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
    }
  }, [isUploading]);

  const updateFileAttachmentType = useCallback((fileId: string, attachmentType: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, attachmentType } : f
    ));
  }, []);

  const uploadFiles = useCallback(async () => {
    // Check if all files have attachment types selected
    const filesWithoutType = files.filter(f => !f.attachmentType);
    if (filesWithoutType.length > 0) {
      toast({
        title: "Attachment types required",
        description: "Please select an attachment type for all files before uploading",
        variant: "destructive"
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      
      // Add files with their attachment types
      files.forEach((uploadFile, index) => {
        formData.append('files', uploadFile.file);
        formData.append(`attachmentTypes[${index}]`, uploadFile.attachmentType!);
      });
      
      formData.append('baseFolderId', baseFolderId);
      formData.append('driveId', driveId);

      // Update file statuses to uploading
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 0 })));

      const response = await fetch(`/api/jobs/${job.id}/attachments`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update file statuses to success
        setFiles(prev => prev.map(f => ({ ...f, status: 'success' as const, progress: 100 })));
        
        toast({
          title: "Upload successful",
          description: `${files.length} file(s) uploaded successfully`,
          variant: "default"
        });

        // Notify parent component
        onUploadSuccess(result.job);
        
        // Close dialog after a short delay to show success state
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        // Update file statuses to error
        setFiles(prev => prev.map(f => ({ 
          ...f, 
          status: 'error' as const, 
          error: result.error || 'Upload failed' 
        })));
        
        toast({
          title: "Upload failed",
          description: result.error || "Failed to upload files",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      // Update file statuses to error
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        error: 'Network error' 
      })));
      
      toast({
        title: "Upload error",
        description: "A network error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  }, [files, baseFolderId, driveId, job.id, toast, onUploadSuccess, handleClose]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" id="job-attachment-upload-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Upload Attachments - Job #{job.id}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Job Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Date:</span> {new Date(job.date).toLocaleDateString()}</div>
                <div><span className="font-medium">Driver:</span> {job.driver}</div>
                <div><span className="font-medium">Customer:</span> {job.customer}</div>
                <div><span className="font-medium">Bill To:</span> {job.billTo}</div>
              </div>
            </div>


            {/* File Drop Zone */}
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-300 dark:border-gray-600'
              } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!isUploading ? handleFileSelect : undefined}
              id="file-drop-zone"
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {isDragOver ? 'Drop files here' : 'Drag and drop files here, or click to select'}
              </p>
              <p className="text-xs text-gray-500">
                Supports images, PDFs, and documents up to 20MB
              </p>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                <h4 className="text-sm font-medium">Selected Files ({files.length})</h4>
                {files.map(uploadFile => (
                  <div key={uploadFile.id} className="space-y-2 p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFileIcon(uploadFile.file)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm truncate">{uploadFile.file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(uploadFile.file.size)}
                          </Badge>
                          {getStatusIcon(uploadFile.status)}
                        </div>
                        {uploadFile.status === 'uploading' && (
                          <Progress value={uploadFile.progress} className="mt-1 h-1" />
                        )}
                        {uploadFile.status === 'error' && (
                          <p className="text-xs text-red-500 mt-1">{uploadFile.error}</p>
                        )}
                      </div>
                      {!isUploading && uploadFile.status !== 'success' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                          className="h-6 w-6 p-0"
                          id={`remove-file-${uploadFile.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Attachment Type Selection for each file */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Attachment Type *</label>
                      <Select 
                        value={uploadFile.attachmentType || ''} 
                        onValueChange={(value) => updateFileAttachmentType(uploadFile.id, value)}
                        disabled={isUploading || uploadFile.status === 'success'}
                      >
                        <SelectTrigger className="h-8 text-xs" id={`attachment-type-${uploadFile.id}`}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTACHMENT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value} className="text-xs">
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-xs text-gray-500">
                {files.length > 0 && (
                  <span>{files.filter(f => f.attachmentType).length}/{files.length} files have attachment types selected</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isUploading} id="cancel-upload-btn">
                  Cancel
                </Button>
                <Button 
                  onClick={uploadFiles} 
                  disabled={files.length === 0 || files.some(f => !f.attachmentType) || isUploading}
                  id="upload-files-btn"
                >
                  {isUploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={Object.keys(ACCEPTED_FILE_TYPES).join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        id="hidden-file-input"
      />
    </>
  );
}
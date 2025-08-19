"use client"

import React, { useState, useEffect } from 'react';
import { useUser } from "@clerk/nextjs";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  Cloud,
  Key,
  Folder,
  FileText,
  Image as ImageIcon,
  Eye,
  Database,
  Paperclip
} from "lucide-react";
import { Spinner } from "@/components/ui/loading-skeleton";
import { PageHeader } from "@/components/brand/icon-logo";
import { DirectoryBrowser } from "@/components/ui/directory-browser";
import dynamic from 'next/dynamic';

const FileViewer = dynamic(() => import("@/components/ui/file-viewer").then(mod => ({ default: mod.FileViewer })), {
  ssr: false,
  loading: () => <div className="flex gap-1"><div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" /></div>
});

interface SharedDrive {
  id: string;
  name: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  isFolder: boolean;
}

export default function IntegrationsPage() {
  useUser();
  const [lastError, setLastError] = useState<string>('');

  // Load saved attachment configuration from database on mount
  const loadAttachmentConfig = async () => {
    try {
      setIsLoadingAttachmentConfig(true);
      setLastError('');
      
      const response = await fetch('/api/google-drive/settings?purpose=job_attachments');
      const data = await response.json();
      
      if (response.ok && data.success && data.settings) {
        setAttachmentConfig({
          baseFolderId: data.settings.baseFolderId,
          driveId: data.settings.driveId,
          folderName: data.settings.folderName,
          folderPath: data.settings.folderPath
        });
        console.log('Loaded Google Drive attachment configuration from database:', data.settings);
      }
    } catch (error) {
      console.error('Error loading attachment config:', error);
      setLastError('Failed to load attachment configuration');
    } finally {
      setIsLoadingAttachmentConfig(false);
    }
  };

  useEffect(() => {
    loadAttachmentConfig();
  }, []);

  // Service Account State
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [selectedSharedDrive, setSelectedSharedDrive] = useState<string>('');
  // const [driveFolders, setDriveFolders] = useState<DriveFile[]>([]);
  const [selectedServiceFolder, setSelectedServiceFolder] = useState<string>('');
  const [folderContents, setFolderContents] = useState<DriveFile[]>([]);
  const [isLoadingSharedDrives, setIsLoadingSharedDrives] = useState(false);
  // const [isLoadingDriveFolders, setIsLoadingDriveFolders] = useState(false);
  const [isLoadingFolderContents, setIsLoadingFolderContents] = useState(false);
  const [isServiceUploading, setIsServiceUploading] = useState(false);

  // Directory Browser State
  const [showDirectoryBrowser, setShowDirectoryBrowser] = useState(false);
  const [selectedBrowserFolder, setSelectedBrowserFolder] = useState<{id: string, name: string, path: string[]} | null>(null);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{id: string, name: string, webViewLink: string, thumbnailLink?: string}>>([]);
  const [viewingImage, setViewingImage] = useState<{id: string, name: string, url: string} | null>(null);

  // Job Attachments Configuration State
  const [attachmentConfig, setAttachmentConfig] = useState<{
    baseFolderId: string;
    driveId: string;
    folderName?: string;
    folderPath?: string[];
  } | null>(null);
  const [isLoadingAttachmentConfig, setIsLoadingAttachmentConfig] = useState(false);
  const [isSavingAttachmentConfig, setIsSavingAttachmentConfig] = useState(false);


  // Service Account Functions
  const fetchSharedDrives = async () => {
    try {
      setIsLoadingSharedDrives(true);
      setLastError('');
      
      const response = await fetch(`/api/google-drive/service-account?action=list-shared-drives`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Shared drives fetched successfully:', data.sharedDrives.length);
        setSharedDrives(data.sharedDrives);
        if (data.sharedDrives.length > 0 && !selectedSharedDrive) {
          setSelectedSharedDrive(data.sharedDrives[0].id);
        }
      } else {
        setLastError(`Failed to fetch shared drives: ${data.error}`);
        console.error('Shared drives fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch shared drives:', error);
      setLastError('Failed to connect to Google Drive service account');
    } finally {
      setIsLoadingSharedDrives(false);
    }
  };

  // const fetchDriveFolders = useCallback(async () => {
  //   if (!selectedSharedDrive) return;

  //   try {
  //     setIsLoadingDriveFolders(true);
  //     setLastError('');
      
  //     const response = await fetch(`/api/google-drive/service-account?action=list-drive-folders&driveId=${selectedSharedDrive}`);
  //     const data = await response.json();
      
  //     if (response.ok && data.success) {
  //       console.log('Drive folders fetched successfully:', data.folders.length);
  //       setDriveFolders(data.folders);
  //     } else {
  //       setLastError(`Failed to fetch drive folders: ${data.error}`);
  //       console.error('Drive folders fetch failed:', data);
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch drive folders:', error);
  //     setLastError('Failed to fetch drive folders');
  //   } finally {
  //     setIsLoadingDriveFolders(false);
  //   }
  // }, [selectedSharedDrive]);

  const fetchFolderContents = async () => {
    const folderId = selectedBrowserFolder?.id || selectedServiceFolder;
    if (!selectedSharedDrive || !folderId) return;

    try {
      setIsLoadingFolderContents(true);
      setLastError('');
      
      const response = await fetch(`/api/google-drive/service-account?action=list-folder-contents&driveId=${selectedSharedDrive}&folderId=${folderId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Folder contents fetched successfully:', data.files.length);
        setFolderContents(data.files);
      } else {
        setLastError(`Failed to fetch folder contents: ${data.error}`);
        console.error('Folder contents fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch folder contents:', error);
      setLastError('Failed to fetch folder contents');
    } finally {
      setIsLoadingFolderContents(false);
    }
  };

  const handleServiceAccountUpload = async () => {
    const folderId = selectedBrowserFolder?.id || selectedServiceFolder;
    if (!selectedSharedDrive || !folderId) return;

    setIsServiceUploading(true);
    setLastError('');

    try {
      const testContent = `service_account_test,data,${new Date().toISOString()}\n1,2,3\n4,5,6`;
      const fileName = `service_test_upload_${new Date().toISOString().split('T')[0]}.csv`;

      const uploadResponse = await fetch('/api/google-drive/service-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          fileContent: testContent,
          driveId: selectedSharedDrive,
          folderId: folderId
        }),
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResponse.ok && uploadResult.success) {
        alert(`Service account upload successful! File ID: ${uploadResult.fileId}`);
        // Refresh folder contents
        fetchFolderContents();
      } else {
        setLastError(`Service account upload failed: ${uploadResult.error}`);
        console.error('Service account upload failed:', uploadResult);
      }
    } catch (error) {
      console.error('Service account upload failed:', error);
      setLastError('Service account upload failed');
    } finally {
      setIsServiceUploading(false);
    }
  };

  // Image Upload Functions
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLastError('Please select a valid image file');
    }
  };

  const handleGoogleDriveImageUpload = async () => {
    const folderId = selectedBrowserFolder?.id || selectedServiceFolder;
    if (!selectedImage || !selectedSharedDrive || !folderId) {
      setLastError('Please select an image, shared drive, and folder first');
      return;
    }

    setIsImageUploading(true);
    setLastError('');

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('driveId', selectedSharedDrive);
      formData.append('folderId', folderId);

      const uploadResponse = await fetch('/api/google-drive/upload-image', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResponse.ok && uploadResult.success) {
        // Add to uploaded images list
        setUploadedImages(prev => [...prev, {
          id: uploadResult.fileId,
          name: uploadResult.fileName,
          webViewLink: uploadResult.webViewLink,
          thumbnailLink: uploadResult.thumbnailLink
        }]);
        alert('Image uploaded to Google Drive successfully!');
        // Refresh folder contents to show the new image
        fetchFolderContents();
      } else {
        setLastError(`Google Drive upload failed: ${uploadResult.error}`);
        console.error('Google Drive upload failed:', uploadResult);
      }
    } catch (error) {
      console.error('Google Drive upload failed:', error);
      setLastError('Google Drive upload failed');
    } finally {
      setIsImageUploading(false);
    }
  };

  const getFileUrl = async (fileId: string): Promise<string> => {
    try {
      const response = await fetch(`/api/google-drive/get-file?fileId=${fileId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        return result.fileUrl || result.imageUrl; // Support both new and old response format
      } else {
        throw new Error(result.error || 'Failed to get file URL');
      }
    } catch (error) {
      console.error('Failed to get file URL:', error);
      throw error;
    }
  };

  // const handleViewImageInApp = async (fileId: string, fileName: string) => {
  //   try {
  //     const url = await getFileUrl(fileId);
  //     setViewingImage({
  //       id: fileId,
  //       name: fileName,
  //       url: url
  //     });
  //   } catch (error) {
  //     setLastError('Failed to load image from Google Drive');
  //   }
  // };

  const handleViewInDrive = (fileId: string) => {
    const viewerUrl = `https://drive.google.com/file/d/${fileId}/view`;
    window.open(viewerUrl, '_blank');
  };

  // Handle directory browser folder selection
  const handleDirectoryBrowserSelect = async (folderId: string, folderName: string, path: string[]) => {
    setSelectedBrowserFolder({ id: folderId, name: folderName, path });
    // Clear the old dropdown selection
    setSelectedServiceFolder('');
    setShowDirectoryBrowser(false);
    
    // Save configuration for job attachments to database
    if (selectedSharedDrive && folderId) {
      await saveAttachmentConfig(folderId, selectedSharedDrive, folderName, path);
    }
  };

  // Save attachment configuration to database
  const saveAttachmentConfig = async (baseFolderId: string, driveId: string, folderName: string, folderPath: string[]) => {
    try {
      setIsSavingAttachmentConfig(true);
      setLastError('');
      
      // Find the selected drive name
      const selectedDrive = sharedDrives.find(drive => drive.id === driveId);
      const driveName = selectedDrive?.name || 'Unknown Drive';
      
      const response = await fetch('/api/google-drive/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driveId,
          driveName,
          baseFolderId,
          folderName,
          folderPath,
          purpose: 'job_attachments'
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        const config = {
          baseFolderId,
          driveId,
          folderName,
          folderPath
        };
        setAttachmentConfig(config);
        console.log('Saved Google Drive attachment configuration to database:', result.settings);
      } else {
        setLastError(`Failed to save attachment configuration: ${result.error}`);
        console.error('Failed to save attachment config:', result);
      }
    } catch (error) {
      console.error('Error saving attachment config:', error);
      setLastError('Failed to save attachment configuration');
    } finally {
      setIsSavingAttachmentConfig(false);
    }
  };

  // Clear job attachments configuration
  const clearAttachmentConfig = async () => {
    try {
      setIsSavingAttachmentConfig(true);
      setLastError('');
      
      const response = await fetch('/api/google-drive/settings?purpose=job_attachments', {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setAttachmentConfig(null);
        console.log('Cleared Google Drive attachment configuration');
      } else {
        setLastError(`Failed to clear attachment configuration: ${result.error}`);
        console.error('Failed to clear attachment config:', result);
      }
    } catch (error) {
      console.error('Error clearing attachment config:', error);
      setLastError('Failed to clear attachment configuration');
    } finally {
      setIsSavingAttachmentConfig(false);
    }
  };

  // Auto-fetch folders when shared drive changes
  // useEffect(() => {
  //   if (selectedSharedDrive) {
  //     fetchDriveFolders();
  //   }
  // }, [selectedSharedDrive, fetchDriveFolders]);

  return (
    <ProtectedLayout>
      <ProtectedRoute 
        requiredPermission="manage_integrations"
        fallbackTitle="Admin Access Required"
        fallbackDescription="Only administrators can access the integrations page. This page contains sensitive system configurations."
      >
        <div className="container mx-auto p-6 max-w-6xl">
          <PageHeader pageType="integrations" />

      <Tabs defaultValue="service-account" className="space-y-6" id="integrations-tabs">
        <TabsList className="grid w-full grid-cols-3" id="integrations-tabs-list">
          <TabsTrigger value="service-account" className="flex items-center gap-2" id="service-account-tab">
            <Key className="h-4 w-4" />
            Service Account
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2" id="database-tab">
            <Database className="h-4 w-4" />
            Database
          </TabsTrigger>
        </TabsList>

        {/* Service Account Tab */}
        <TabsContent value="service-account" className="space-y-6" id="service-account-content">
          <div className="grid gap-6">
            {/* Service Account Status */}
            <Card id="service-account-status-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Google Drive Service Account
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </CardTitle>
                <CardDescription>
                  Test Google Drive operations using service account with domain-wide delegation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Service Account Active</Badge>
                    <Badge variant="outline">Domain-wide Delegation</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <Button onClick={fetchSharedDrives} disabled={isLoadingSharedDrives} id="load-shared-drives-btn">
                      {isLoadingSharedDrives ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {isLoadingSharedDrives ? 'Loading...' : 'Load Shared Drives'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shared Drives Section */}
            {sharedDrives.length > 0 && (
              <Card id="shared-drives-card">
                <CardHeader>
                  <CardTitle>Shared Drives</CardTitle>
                  <CardDescription>
                    Select a shared drive and folder for testing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Shared Drive:</label>
                        <select
                          value={selectedSharedDrive}
                          onChange={(e) => setSelectedSharedDrive(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          id="shared-drive-select"
                        >
                          <option value="">Select a shared drive</option>
                          {sharedDrives.map((drive) => (
                            <option key={drive.id} value={drive.id}>
                              {drive.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Folder:</label>
                        <div className="flex gap-2">
                          {selectedBrowserFolder && (
                            <div className="flex-1">
                              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm items-center">
                                <Folder className="h-4 w-4 text-blue-500 mr-2" />
                                <span className="flex-1 truncate">
                                  {selectedBrowserFolder.path.join(' / ')}
                                </span>
                                {attachmentConfig && attachmentConfig.baseFolderId === selectedBrowserFolder.id && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    <Paperclip className="h-3 w-3 mr-1" />
                                    Job Attachments
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                          <Button
                            onClick={() => setShowDirectoryBrowser(true)}
                            disabled={!selectedSharedDrive || isSavingAttachmentConfig}
                            variant="outline"
                            size="sm"
                            className="h-10"
                            id="browse-folder-btn"
                          >
                            {isSavingAttachmentConfig ? (
                              <Spinner size="sm" className="mr-2" />
                            ) : (
                              <Folder className="h-4 w-4 mr-2" />
                            )}
                            {isSavingAttachmentConfig ? 'Saving...' : 'Browse'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={fetchFolderContents} 
                        disabled={!selectedSharedDrive || (!selectedServiceFolder && !selectedBrowserFolder?.id) || isLoadingFolderContents}
                        id="load-folder-contents-btn"
                      >
                        {isLoadingFolderContents ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <Folder className="h-4 w-4 mr-2" />
                        )}
                        {isLoadingFolderContents ? 'Loading...' : 'Load Folder Contents'}
                      </Button>
                      <Button 
                        onClick={handleServiceAccountUpload} 
                        disabled={!selectedSharedDrive || (!selectedServiceFolder && !selectedBrowserFolder?.id) || isServiceUploading}
                        id="test-upload-btn"
                      >
                        {isServiceUploading ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isServiceUploading ? 'Uploading...' : 'Test Upload'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Folder Contents Section */}
            {folderContents.length > 0 && (
              <Card id="folder-contents-card">
                <CardHeader>
                  <CardTitle>Folder Contents</CardTitle>
                  <CardDescription>
                    Files and folders in the selected directory
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {folderContents.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 p-2 rounded border">
                        {file.isFolder ? (
                          <Folder className="h-4 w-4 text-blue-500" />
                        ) : file.mimeType.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4 text-green-500" aria-label="Image file" />
                        ) : file.mimeType === 'application/pdf' ? (
                          <FileText className="h-4 w-4 text-red-500" aria-label="PDF file" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-500" />
                        )}
                        <span className="flex-1">{file.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {file.isFolder ? 'Folder' : file.mimeType.split('/').pop()?.toUpperCase()}
                        </Badge>
                        <FileViewer 
                          file={file}
                          onViewInDrive={handleViewInDrive}
                          getFileUrl={getFileUrl}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Attachments Configuration Section */}
            <Card id="job-attachments-config-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Job Attachments Configuration
                  {isLoadingAttachmentConfig && <Spinner size="sm" />}
                </CardTitle>
                <CardDescription>
                  Configure where job attachments (runsheets, dockets, delivery photos) will be stored
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAttachmentConfig ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="lg" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading configuration...</span>
                  </div>
                ) : attachmentConfig ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Configuration Active
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Job attachments will be organized automatically
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Storage Location:</label>
                        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm font-mono">
                          {attachmentConfig.folderPath?.join(' / ') || 'No path available'}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Organization Structure:</label>
                        <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs">
                          <div className="font-mono space-y-1">
                            <div><span className="text-gray-500">📁</span> {attachmentConfig.folderName || 'Base Folder'}</div>
                            <div className="ml-4"><span className="text-gray-500">📁</span> [Week Ending - DD.MM.YY]</div>
                            <div className="ml-8"><span className="text-gray-500">📁</span> [Customer - Bill To]</div>
                            <div className="ml-12"><span className="text-gray-500">📄</span> DD.MM_Driver_Customer_BillTo_TruckType_AttachmentType.ext</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <AlertCircle className="h-4 w-4" />
                        <span>To change the folder, select a new folder using the &ldquo;Browse&rdquo; button above</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAttachmentConfig}
                        disabled={isSavingAttachmentConfig}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        id="clear-attachment-config-btn"
                      >
                        {isSavingAttachmentConfig ? (
                          <Spinner size="sm" className="mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        {isSavingAttachmentConfig ? 'Clearing...' : 'Clear Configuration'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-full">
                        <AlertCircle className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          No Configuration Set
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Select a shared drive and folder above to configure job attachments storage
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>↑</span>
                        <span>Use the &ldquo;Browse&rdquo; button to select a folder</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image Upload Section */}
            <Card id="image-upload-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" aria-label="Image upload" />
                  Image Upload Test
                </CardTitle>
                <CardDescription>
                  Upload images to the selected Google Drive folder
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Select Image:</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        id="image-file-input"
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <Button 
                        onClick={handleGoogleDriveImageUpload} 
                        disabled={!selectedImage || !selectedSharedDrive || (!selectedServiceFolder && !selectedBrowserFolder?.id) || isImageUploading}
                        className="w-full"
                        id="upload-to-drive-btn"
                      >
                        {isImageUploading ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {isImageUploading ? 'Uploading...' : 'Upload to Drive'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Preview:</h4>
                      <div className="border rounded-lg p-4" id="image-preview-container">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={imagePreview} 
                          alt="Selected image preview" 
                          className="max-w-full max-h-64 object-contain rounded"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Google Drive Uploaded Images */}
            {uploadedImages.length > 0 && (
              <Card id="uploaded-images-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Recently Uploaded Images
                  </CardTitle>
                  <CardDescription>
                    Click on any image to view it in Google Drive
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uploadedImages.map((image) => (
                      <div key={image.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium truncate">{image.name}</h4>
                          {image.thumbnailLink ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={image.thumbnailLink} 
                              alt={image.name}
                              className="w-full h-32 object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" aria-label="No image preview" />
                            </div>
                          )}
                          <Button 
                            onClick={() => window.open(image.webViewLink, '_blank')}
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            id={`uploaded-image-view-${image.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View in Drive
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {lastError && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lastError}</AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-6" id="database-content">
          <Card id="database-status-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Status
              </CardTitle>
              <CardDescription>
                Monitor database connections and health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Database integration status and connection monitoring will be available here.
                </p>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="image-viewer-modal">
          <div className="bg-background rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{viewingImage.name}</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    const viewerUrl = `https://drive.google.com/file/d/${viewingImage.id}/view`;
                    window.open(viewerUrl, '_blank');
                  }}
                  variant="outline" 
                  size="sm"
                  id="view-in-drive-modal-btn"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  View in Drive
                </Button>
                <Button 
                  onClick={() => setViewingImage(null)}
                  variant="outline" 
                  size="sm"
                  id="close-image-viewer-btn"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={viewingImage.url} 
                alt={viewingImage.name}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Directory Browser Dialog */}
      <DirectoryBrowser
        isOpen={showDirectoryBrowser}
        onClose={() => setShowDirectoryBrowser(false)}
        driveId={selectedSharedDrive}
        onSelectFolder={handleDirectoryBrowserSelect}
        title="Select Google Drive Folder"
        allowFileSelection={false}
        allowFolderSelection={true}
      />
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
} 
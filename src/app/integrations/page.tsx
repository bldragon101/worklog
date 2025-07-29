"use client"

import React, { useState, useEffect } from 'react';
import { useUser } from "@clerk/nextjs";
import { ProtectedLayout } from "@/components/protected-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  Download,
  Shield,
  Database,
  Settings,
  TestTube,
  Cloud,
  Key,
  Folder,
  FileText,
  Image,
  Eye
} from "lucide-react";

interface GoogleDriveFolder {
  id: string;
  name: string;
  driveId?: string;
}

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

interface DebugInfo {
  foldersCount?: number;
  sharedDrivesCount?: number;
  lastFetched?: string;
  lastUpload?: {
    success: boolean;
    fileId: string;
    fileName: string;
    webViewLink: string;
    timestamp: string;
  };
}

export default function IntegrationsPage() {
  const { user, isLoaded } = useUser();
  const [googleDriveToken, setGoogleDriveToken] = useState<string>('');
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [isUploading, setIsUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [lastError, setLastError] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  // Service Account State
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [selectedSharedDrive, setSelectedSharedDrive] = useState<string>('');
  const [driveFolders, setDriveFolders] = useState<DriveFile[]>([]);
  const [selectedServiceFolder, setSelectedServiceFolder] = useState<string>('');
  const [folderContents, setFolderContents] = useState<DriveFile[]>([]);
  const [isLoadingSharedDrives, setIsLoadingSharedDrives] = useState(false);
  const [isLoadingDriveFolders, setIsLoadingDriveFolders] = useState(false);
  const [isLoadingFolderContents, setIsLoadingFolderContents] = useState(false);
  const [isServiceUploading, setIsServiceUploading] = useState(false);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{id: string, name: string, webViewLink: string, thumbnailLink?: string}>>([]);
  const [viewingImage, setViewingImage] = useState<{id: string, name: string, url: string} | null>(null);

  // Set client flag and load token from localStorage on component mount
  useEffect(() => {
    setIsClient(true);
    const savedToken = localStorage.getItem('googleDriveToken');
    if (savedToken) {
      console.log('Loaded token from localStorage');
      setGoogleDriveToken(savedToken);
      fetchFolders(savedToken);
    }
  }, []);

  // Check for tokens in URL params (from OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const state = urlParams.get('state');
    
    console.log('URL params:', { 
      accessToken: !!accessToken, 
      refreshToken: !!refreshToken, 
      state 
    });
    
    if (accessToken) {
      console.log('Setting Google Drive token from URL');
      setGoogleDriveToken(accessToken);
      // Save to localStorage for persistence
      localStorage.setItem('googleDriveToken', accessToken);
      if (refreshToken) {
        localStorage.setItem('googleDriveRefreshToken', refreshToken);
      }
      fetchFolders(accessToken);
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('access_token');
      newUrl.searchParams.delete('refresh_token');
      newUrl.searchParams.delete('state');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const handleGoogleDriveAuth = async () => {
    try {
      setLastError('');
      const response = await fetch('/api/google-drive/auth?state=test');
      const data = await response.json();
      
      if (response.ok) {
        console.log('Redirecting to Google OAuth:', data.authUrl);
        window.location.href = data.authUrl;
      } else {
        setLastError('Failed to start Google Drive authentication');
        console.error('Auth failed:', data);
      }
    } catch (error) {
      console.error('Failed to authenticate with Google Drive:', error);
      setLastError('Failed to authenticate with Google Drive');
    }
  };

  const handleDisconnect = () => {
    setGoogleDriveToken('');
    setFolders([]);
    localStorage.removeItem('googleDriveToken');
    localStorage.removeItem('googleDriveRefreshToken');
    setDebugInfo({});
    setLastError('');
  };

  const fetchFolders = async (token: string) => {
    try {
      setIsLoadingFolders(true);
      setLastError('');
      
      const response = await fetch(`/api/google-drive/folders?accessToken=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('Folders fetched successfully:', data.folders.length);
        setFolders(data.folders);
        setDebugInfo({
          foldersCount: data.folders.length,
          sharedDrivesCount: data.sharedDrives?.length || 0,
          lastFetched: new Date().toISOString()
        });
      } else {
        setLastError(`Failed to fetch folders: ${data.error}`);
        console.error('Folder fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      setLastError('Failed to connect to Google Drive');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleTestUpload = async () => {
    if (!googleDriveToken) return;

    setIsUploading(true);
    setLastError('');

    try {
      const testContent = `test,data,${new Date().toISOString()}\n1,2,3\n4,5,6`;
      const fileName = `test_upload_${new Date().toISOString().split('T')[0]}.csv`;

      const uploadResponse = await fetch('/api/google-drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: googleDriveToken,
          fileName,
          fileContent: testContent,
          folderId: selectedFolderId === 'root' ? undefined : selectedFolderId,
        }),
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResponse.ok) {
        setDebugInfo(prev => ({
          ...prev,
          lastUpload: {
            success: true,
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            webViewLink: uploadResult.webViewLink,
            timestamp: new Date().toISOString()
          }
        }));
        alert(`Test upload successful! View file: ${uploadResult.webViewLink}`);
      } else {
        setLastError(`Upload failed: ${uploadResult.error}`);
        console.error('Upload failed:', uploadResult);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setLastError('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const refreshFolders = () => {
    if (googleDriveToken) {
      fetchFolders(googleDriveToken);
    }
  };

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

  const fetchDriveFolders = async () => {
    if (!selectedSharedDrive) return;

    try {
      setIsLoadingDriveFolders(true);
      setLastError('');
      
      const response = await fetch(`/api/google-drive/service-account?action=list-drive-folders&driveId=${selectedSharedDrive}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Drive folders fetched successfully:', data.folders.length);
        setDriveFolders(data.folders);
      } else {
        setLastError(`Failed to fetch drive folders: ${data.error}`);
        console.error('Drive folders fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch drive folders:', error);
      setLastError('Failed to fetch drive folders');
    } finally {
      setIsLoadingDriveFolders(false);
    }
  };

  const fetchFolderContents = async () => {
    if (!selectedSharedDrive || !selectedServiceFolder) return;

    try {
      setIsLoadingFolderContents(true);
      setLastError('');
      
      const response = await fetch(`/api/google-drive/service-account?action=list-folder-contents&driveId=${selectedSharedDrive}&folderId=${selectedServiceFolder}`);
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
    if (!selectedSharedDrive || !selectedServiceFolder) return;

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
          folderId: selectedServiceFolder
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
    if (!selectedImage || !selectedSharedDrive || !selectedServiceFolder) {
      setLastError('Please select an image, shared drive, and folder first');
      return;
    }

    setIsImageUploading(true);
    setLastError('');

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('driveId', selectedSharedDrive);
      formData.append('folderId', selectedServiceFolder);

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

  const handleViewImageInApp = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/google-drive/get-image?fileId=${fileId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        setViewingImage({
          id: fileId,
          name: fileName,
          url: result.imageUrl
        });
      } else {
        setLastError(`Failed to load image: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to load image:', error);
      setLastError('Failed to load image from Google Drive');
    }
  };

  // Auto-fetch folders when shared drive changes
  useEffect(() => {
    if (selectedSharedDrive) {
      fetchDriveFolders();
    }
  }, [selectedSharedDrive]);

  return (
    <ProtectedLayout>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Manage and test external service integrations
          </p>
        </div>

      <Tabs defaultValue="google-drive" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="google-drive" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Google Drive
          </TabsTrigger>
          <TabsTrigger value="service-account" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Service Account
          </TabsTrigger>
          <TabsTrigger value="auth-test" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Auth Test
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database
          </TabsTrigger>
        </TabsList>

        {/* Google Drive Tab */}
        <TabsContent value="google-drive" className="space-y-6">
          <div className="grid gap-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Google Drive Connection
                  {googleDriveToken ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </CardTitle>
                <CardDescription>
                  Connect to Google Drive for automatic CSV uploads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={googleDriveToken ? "default" : "secondary"}>
                      {googleDriveToken ? "Connected" : "Not Connected"}
                    </Badge>
                    {googleDriveToken && (
                      <Badge variant="outline">
                        Token: {googleDriveToken.substring(0, 20)}...
                      </Badge>
                    )}
                  </div>
                  
                  {googleDriveToken ? (
                    <div className="space-y-2">
                      <Button onClick={handleDisconnect} variant="outline" size="sm">
                        Disconnect
                      </Button>
                      <Button onClick={refreshFolders} variant="outline" size="sm" disabled={isLoadingFolders}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingFolders ? 'animate-spin' : ''}`} />
                        Refresh Folders
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleGoogleDriveAuth} className="w-full">
                      Connect to Google Drive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {lastError && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lastError}</AlertDescription>
              </Alert>
            )}

            {/* Folders Section */}
            {googleDriveToken && (
              <Card>
                <CardHeader>
                  <CardTitle>Google Drive Folders</CardTitle>
                  <CardDescription>
                    Select a folder for test uploads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedFolderId}
                        onChange={(e) => setSelectedFolderId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      >
                        <option value="root">Root Folder</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name} {folder.driveId ? '(Shared Drive)' : ''}
                          </option>
                        ))}
                      </select>
                      <Button onClick={handleTestUpload} disabled={isUploading}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Test Upload'}
                      </Button>
                    </div>
                    
                    {isLoadingFolders && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading folders...
                      </div>
                    )}
                    
                    {folders.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Found {folders.length} folders
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Debug Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Debug Information
                </CardTitle>
                <CardDescription>
                  Technical details for troubleshooting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <div>
                       <h4 className="font-medium mb-2">Environment</h4>
                       <div className="text-sm space-y-1">
                         <div>User Agent: {isClient ? navigator.userAgent : 'Loading...'}</div>
                         <div>Platform: {isClient ? navigator.platform : 'Loading...'}</div>
                         <div>URL: {isClient ? window.location.href : 'Loading...'}</div>
                       </div>
                     </div>
                    
                                           <div>
                         <h4 className="font-medium mb-2">Token Status</h4>
                         <div className="text-sm space-y-1">
                           <div>Has Token: {googleDriveToken ? 'Yes' : 'No'}</div>
                           <div>Token Length: {googleDriveToken?.length || 0}</div>
                           <div>Local Storage: {isClient ? (localStorage.getItem('googleDriveToken') ? 'Available' : 'Not Available') : 'Loading...'}</div>
                         </div>
                       </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">API Status</h4>
                    <div className="text-sm space-y-1">
                      <div>Folders Count: {folders.length}</div>
                      <div>Selected Folder: {selectedFolderId}</div>
                      {debugInfo.lastFetched && (
                        <div>Last Fetched: {new Date(debugInfo.lastFetched).toLocaleString()}</div>
                      )}
                      {debugInfo.lastUpload && (
                        <div>Last Upload: {new Date(debugInfo.lastUpload.timestamp).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  
                  {Object.keys(debugInfo).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Raw Debug Data</h4>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Service Account Tab */}
        <TabsContent value="service-account" className="space-y-6">
          <div className="grid gap-6">
            {/* Service Account Status */}
            <Card>
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
                    <Button onClick={fetchSharedDrives} disabled={isLoadingSharedDrives}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSharedDrives ? 'animate-spin' : ''}`} />
                      {isLoadingSharedDrives ? 'Loading...' : 'Load Shared Drives'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shared Drives Section */}
            {sharedDrives.length > 0 && (
              <Card>
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
                        <select
                          value={selectedServiceFolder}
                          onChange={(e) => setSelectedServiceFolder(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                          disabled={!selectedSharedDrive || isLoadingDriveFolders}
                        >
                          <option value="">Select a folder</option>
                          {driveFolders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {isLoadingDriveFolders && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading folders...
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Button onClick={fetchFolderContents} disabled={!selectedSharedDrive || !selectedServiceFolder || isLoadingFolderContents}>
                        <Folder className="h-4 w-4 mr-2" />
                        {isLoadingFolderContents ? 'Loading...' : 'Load Folder Contents'}
                      </Button>
                      <Button onClick={handleServiceAccountUpload} disabled={!selectedSharedDrive || !selectedServiceFolder || isServiceUploading}>
                        <Upload className="h-4 w-4 mr-2" />
                        {isServiceUploading ? 'Uploading...' : 'Test Upload'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Folder Contents Section */}
            {folderContents.length > 0 && (
              <Card>
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
                          <Image className="h-4 w-4 text-green-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-500" />
                        )}
                        <span className="flex-1">{file.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {file.isFolder ? 'Folder' : file.mimeType.split('/').pop()?.toUpperCase()}
                        </Badge>
                        {!file.isFolder && file.mimeType.startsWith('image/') && (
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => handleViewImageInApp(file.id, file.name)}
                              variant="outline" 
                              size="sm"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              onClick={() => {
                                // Generate Google Drive viewer URL
                                const viewerUrl = `https://drive.google.com/file/d/${file.id}/view`;
                                window.open(viewerUrl, '_blank');
                              }}
                              variant="outline" 
                              size="sm"
                            >
                              <Cloud className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Image Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
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
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <Button 
                        onClick={handleGoogleDriveImageUpload} 
                        disabled={!selectedImage || !selectedSharedDrive || !selectedServiceFolder || isImageUploading}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isImageUploading ? 'Uploading...' : 'Upload to Drive'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Preview:</h4>
                      <div className="border rounded-lg p-4">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
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
              <Card>
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
                            <img 
                              src={image.thumbnailLink} 
                              alt={image.name}
                              className="w-full h-32 object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                              <Image className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <Button 
                            onClick={() => window.open(image.webViewLink, '_blank')}
                            variant="outline" 
                            size="sm" 
                            className="w-full"
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

        {/* Auth Test Tab */}
        <TabsContent value="auth-test" className="space-y-6">
          {!isLoaded ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Authentication Test
                </CardTitle>
                <CardDescription>
                  Loading authentication status...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="text-lg">Loading...</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Authentication Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Authentication Status
                    {user ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Current authentication and user session status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={user ? "default" : "secondary"}>
                        {user ? "Authenticated" : "Not Authenticated"}
                      </Badge>
                      {user && (
                        <Badge variant="outline">
                          User ID: {user.id?.substring(0, 8)}...
                        </Badge>
                      )}
                    </div>
                    
                    {user && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <p className="text-green-800 dark:text-green-200 text-sm">
                          ✅ Authentication is working correctly! You can access protected content.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* User Information */}
              {user && (
                <Card>
                  <CardHeader>
                    <CardTitle>User Information</CardTitle>
                    <CardDescription>
                      Details about the authenticated user
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Basic Info</h4>
                          <div className="text-sm space-y-1">
                            <div><strong>User ID:</strong> {user.id}</div>
                            <div><strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}</div>
                            <div><strong>First Name:</strong> {user.firstName || 'Not provided'}</div>
                            <div><strong>Last Name:</strong> {user.lastName || 'Not provided'}</div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Account Details</h4>
                          <div className="text-sm space-y-1">
                            <div><strong>Created:</strong> {user.createdAt?.toLocaleDateString()}</div>
                            <div><strong>Last Sign In:</strong> {user.lastSignInAt?.toLocaleDateString() || 'Unknown'}</div>
                            <div><strong>Email Verified:</strong> {user.emailAddresses[0]?.verification?.status === 'verified' ? 'Yes' : 'No'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Session Debug */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    Session Debug
                  </CardTitle>
                  <CardDescription>
                    Technical details for troubleshooting authentication
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Session Status</h4>
                        <div className="text-sm space-y-1">
                          <div>Loaded: {isLoaded ? 'Yes' : 'No'}</div>
                          <div>User: {user ? 'Present' : 'Not Present'}</div>
                          <div>User ID: {user?.id || 'None'}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Environment</h4>
                        <div className="text-sm space-y-1">
                          <div>Client: {isClient ? 'Yes' : 'No'}</div>
                          <div>Platform: {isClient ? navigator.platform : 'Loading...'}</div>
                          <div>User Agent: {isClient ? navigator.userAgent.substring(0, 50) + '...' : 'Loading...'}</div>
                        </div>
                      </div>
                    </div>
                    
                    {user && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Raw User Data</h4>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify({
                              id: user.id,
                              email: user.emailAddresses[0]?.emailAddress,
                              firstName: user.firstName,
                              lastName: user.lastName,
                              createdAt: user.createdAt,
                              lastSignInAt: user.lastSignInAt,
                              emailVerified: user.emailAddresses[0]?.verification?.status
                            }, null, 2)}
                          </pre>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-6">
          <Card>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  View in Drive
                </Button>
                <Button 
                  onClick={() => setViewingImage(null)}
                  variant="outline" 
                  size="sm"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <img 
                src={viewingImage.url} 
                alt={viewingImage.name}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedLayout>
  );
} 
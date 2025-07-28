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
  Key
} from "lucide-react";

interface GoogleDriveFolder {
  id: string;
  name: string;
  driveId?: string;
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="google-drive" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Google Drive
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
    </div>
    </ProtectedLayout>
  );
} 
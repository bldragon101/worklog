"use client"

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Download, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";

interface ImportResult {
  success: boolean;
  imported?: number;
  errors?: string[];
  totalRows?: number;
  error?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  driveId?: string;
}

interface CsvImportExportProps {
  type: 'worklog' | 'customers';
  onImportSuccess?: () => void;
  filters?: {
    startDate?: string;
    endDate?: string;
    customer?: string;
    driver?: string;
    billTo?: string;
  };
}

export function CsvImportExport({ type, onImportSuccess, filters }: CsvImportExportProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [googleDriveToken, setGoogleDriveToken] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add token refresh function
  const refreshGoogleDriveToken = async (refreshToken: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/google-drive/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;
        
        // Update localStorage
        localStorage.setItem('googleDriveToken', newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('googleDriveRefreshToken', newRefreshToken);
        }
        
        // Update state
        setGoogleDriveToken(newAccessToken);
        return newAccessToken;
      } else {
        console.error('Failed to refresh token');
        return null;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/api/import/${type}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult({
          success: true,
          imported: result.imported,
          errors: result.errors,
          totalRows: result.totalRows,
        });
        onImportSuccess?.();
      } else {
        setImportResult({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        error: 'Import failed',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
      }

      const response = await fetch(`/api/export/${type}?${params.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setIsExportOpen(false);
      } else {
        alert('Export failed');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGoogleDriveAuth = async () => {
    try {
      const response = await fetch(`/api/google-drive/auth?state=${type}`);
      const data = await response.json();
      
      if (response.ok) {
        window.location.href = data.authUrl;
      } else {
        alert('Failed to start Google Drive authentication');
      }
    } catch (error) {
      console.error('Failed to authenticate with Google Drive:', error);
      alert('Failed to authenticate with Google Drive');
    }
  };

  const handleDisconnectGoogleDrive = () => {
    setGoogleDriveToken('');
    setFolders([]);
    setSelectedFolderId('root');
    localStorage.removeItem('googleDriveToken');
    localStorage.removeItem('googleDriveRefreshToken');
  };

  // Load token from localStorage on component mount
  React.useEffect(() => {
    const savedToken = localStorage.getItem('googleDriveToken');
    if (savedToken) {
      setGoogleDriveToken(savedToken);
      // Don't fetch folders immediately - wait until export dialog is opened
    }
  }, []);

  // Check for tokens in URL params (from OAuth callback)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const state = urlParams.get('state');
    
    if (accessToken && state === type) {
      setGoogleDriveToken(accessToken);
      // Save to localStorage for persistence
      localStorage.setItem('googleDriveToken', accessToken);
      if (refreshToken) {
        localStorage.setItem('googleDriveRefreshToken', refreshToken);
      }
      // Fetch folders immediately after OAuth callback
      fetchFolders(accessToken);
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('access_token');
      newUrl.searchParams.delete('refresh_token');
      newUrl.searchParams.delete('state');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [type]);

  // Fetch folders when export dialog opens
  React.useEffect(() => {
    if (isExportOpen && googleDriveToken && folders.length === 0 && !isLoadingFolders) {
      fetchFolders(googleDriveToken);
    }
  }, [isExportOpen, googleDriveToken]);

  const handleGoogleDriveUpload = async () => {
    if (!googleDriveToken) return;

    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
      }

      const response = await fetch(`/api/export/${type}?${params.toString()}`);
      
      if (response.ok) {
        const csvContent = await response.text();
        const fileName = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;

        const uploadResponse = await fetch('/api/google-drive/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: googleDriveToken,
            fileName,
            fileContent: csvContent,
            folderId: selectedFolderId === 'root' ? undefined : selectedFolderId,
          }),
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResponse.ok) {
          alert(`File uploaded successfully! View it here: ${uploadResult.webViewLink}`);
          setIsExportOpen(false);
        } else {
          // Handle token expiration in upload
          if (uploadResponse.status === 401) {
            console.log('Upload failed with 401, attempting token refresh');
            const refreshToken = localStorage.getItem('googleDriveRefreshToken');
            if (refreshToken) {
              const newToken = await refreshGoogleDriveToken(refreshToken);
              if (newToken) {
                // Retry upload with new token
                console.log('Token refreshed, retrying upload');
                const retryResponse = await fetch('/api/google-drive/upload', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    accessToken: newToken,
                    fileName,
                    fileContent: csvContent,
                    folderId: selectedFolderId === 'root' ? undefined : selectedFolderId,
                  }),
                });

                const retryResult = await retryResponse.json();
                if (retryResponse.ok) {
                  alert(`File uploaded successfully! View it here: ${retryResult.webViewLink}`);
                  setIsExportOpen(false);
                  return;
                } else {
                  // If retry also fails, clear tokens and prompt for re-auth
                  console.log('Retry also failed, clearing tokens');
                  localStorage.removeItem('googleDriveToken');
                  localStorage.removeItem('googleDriveRefreshToken');
                  setGoogleDriveToken('');
                  alert('Authentication expired. Please re-authenticate with Google Drive.');
                  return;
                }
              } else {
                // If refresh fails, clear tokens and prompt for re-auth
                console.log('Token refresh failed, clearing tokens');
                localStorage.removeItem('googleDriveToken');
                localStorage.removeItem('googleDriveRefreshToken');
                setGoogleDriveToken('');
                alert('Authentication expired. Please re-authenticate with Google Drive.');
                return;
              }
            } else {
              // No refresh token available
              console.log('No refresh token available');
              localStorage.removeItem('googleDriveToken');
              setGoogleDriveToken('');
              alert('Authentication expired. Please re-authenticate with Google Drive.');
              return;
            }
          }
          
          const errorMessage = uploadResult.error || 'Upload failed';
          alert(`Upload failed: ${errorMessage}`);
        }
      } else {
        alert('Export failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchFolders = async (token: string) => {
    try {
      setIsLoadingFolders(true);
      const response = await fetch(`/api/google-drive/folders?accessToken=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        const allFolders = [...data.sharedDrives, ...data.folders];
        setFolders(allFolders);
        console.log(`Found ${allFolders.length} folders (${data.sharedDrives.length} shared drives, ${data.folders.length} folders)`);
        console.log('Folders:', data.folders.map((f: GoogleDriveFolder) => ({ name: f.name, id: f.id, driveId: f.driveId })));
      } else {
        console.error('Failed to fetch folders:', data.error);
        
        // Handle specific error cases
        if (response.status === 401) {
          // Token is expired or invalid - try to refresh
          console.log('Google Drive token expired, attempting to refresh');
          const refreshToken = localStorage.getItem('googleDriveRefreshToken');
          
          if (refreshToken) {
            const newToken = await refreshGoogleDriveToken(refreshToken);
            if (newToken) {
              // Retry with new token
              console.log('Token refreshed, retrying folder fetch');
              await fetchFolders(newToken);
              return;
            }
          }
          
          // If refresh failed or no refresh token, disconnect
          console.log('Token refresh failed, clearing stored tokens');
          handleDisconnectGoogleDrive();
          return;
        }
        
        // For other errors, show a more specific message
        const errorMessage = data.error || 'Failed to fetch Google Drive folders';
        console.error('Google Drive folder fetch error:', errorMessage);
        // Only show alert for non-auth related errors
        if (response.status !== 401) {
          alert(`Failed to fetch Google Drive folders: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('Failed to connect to Google Drive. Please check your internet connection and try again.');
      } else {
        // For other errors, try to refresh the token or disconnect
        console.log('Network or other error, attempting to refresh connection');
        handleDisconnectGoogleDrive();
      }
    } finally {
      setIsLoadingFolders(false);
    }
  };

    return (
    <div className="flex gap-2">
      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import {type} from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select CSV File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                ref={fileInputRef}
              />
            </div>
            
            {importResult && (
              <div className={`p-4 rounded-lg border ${importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-start gap-2">
                  {importResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="text-sm">
                    {importResult.success ? (
                      <div>
                        <p>Successfully imported {importResult.imported} out of {importResult.totalRows} rows.</p>
                        {importResult.errors && importResult.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="font-semibold">Errors:</p>
                            <ul className="text-sm">
                              {importResult.errors.slice(0, 5).map((error: string, index: number) => (
                                <li key={index}>{error}</li>
                              ))}
                              {importResult.errors.length > 5 && (
                                <li>... and {importResult.errors.length - 5} more errors</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p>{importResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!selectedFile || isImporting}
              >
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog with Google Drive Option */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export {type} to CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Export your {type} data to a CSV file. The export will include all current filters.
            </p>
            
            {/* Google Drive Upload Section */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Upload to Google Drive (Optional)</h4>
              
              {!googleDriveToken ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Connect to Google Drive to automatically upload your exported CSV file.
                  </p>
                  <Button onClick={handleGoogleDriveAuth} variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Connect Google Drive
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600">Connected to Google Drive</span>
                    </div>
                    <Button onClick={handleDisconnectGoogleDrive} variant="outline" size="sm">
                      Disconnect
                    </Button>
                  </div>
                  
                  {isLoadingFolders ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600">Loading folders...</p>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="folder">Select Folder (Optional)</Label>
                      <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a folder or upload to My Drive" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="root">My Drive (Root)</SelectItem>
                          {folders.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              No folders found. File will be uploaded to My Drive.
                            </div>
                          ) : (
                            <>
                              {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name} {folder.driveId ? '(Shared Drive)' : '(My Drive)'}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to upload to My Drive root, or select a specific folder.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsExportOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export to CSV'}
              </Button>
              {googleDriveToken && (
                <Button 
                  onClick={handleGoogleDriveUpload} 
                  disabled={isExporting}
                  variant="secondary"
                >
                  {isExporting ? 'Uploading...' : 'Export & Upload to Drive'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
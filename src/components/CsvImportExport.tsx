"use client"

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react";

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
  const [importResult, setImportResult] = useState<any>(null);
  const [googleDriveToken, setGoogleDriveToken] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [folders, setFolders] = useState<any[]>([]);
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      alert('Failed to authenticate with Google Drive');
    }
  };

  // Check for tokens in URL params (from OAuth callback)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const state = urlParams.get('state');
    
    console.log('URL params:', { accessToken: !!accessToken, state, type });
    
    if (accessToken && state === type) {
      console.log('Setting Google Drive token and opening dialog');
      setGoogleDriveToken(accessToken);
      fetchFolders(accessToken);
      // Open the Google Drive dialog automatically after successful auth
      setIsGoogleDriveOpen(true);
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('access_token');
      newUrl.searchParams.delete('refresh_token');
      newUrl.searchParams.delete('state');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [type]);

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
          setIsGoogleDriveOpen(false);
        } else {
          const errorMessage = uploadResult.error || 'Upload failed';
          alert(`Upload failed: ${errorMessage}`);
        }
      } else {
        alert('Export failed');
      }
    } catch (error) {
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
        console.log('Folders:', data.folders.map((f: any) => ({ name: f.name, id: f.id, driveId: f.driveId })));
      } else {
        console.error('Failed to fetch folders:', data.error);
        alert('Failed to fetch Google Drive folders. Please try again.');
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      alert('Failed to connect to Google Drive. Please check your internet connection and try again.');
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
                        {importResult.errors.length > 0 && (
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

      {/* Export Dialog */}
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Drive Upload Dialog */}
      <Dialog open={isGoogleDriveOpen} onOpenChange={setIsGoogleDriveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Upload to Drive
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload {type} to Google Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!googleDriveToken ? (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Connect to Google Drive to upload your exported CSV files.
                </p>
                <Button onClick={handleGoogleDriveAuth} className="w-full">
                  Connect Google Drive
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoadingFolders ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">Loading folders...</p>
                  </div>
                ) : (
                  <>
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsGoogleDriveOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleGoogleDriveUpload} 
                        disabled={isExporting}
                      >
                        {isExporting ? 'Uploading...' : 'Upload to Drive'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
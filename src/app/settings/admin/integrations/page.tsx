"use client";

import { ChangeEvent, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Upload,
  Cloud,
  Folder,
  FileText,
  Image as ImageIcon,
  Eye,
  Database,
  Paperclip,
  LogIn,
  LogOut,
  Link2,
  Link2Off,
} from "lucide-react";
import { Spinner } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/brand/icon-logo";
import { DirectoryBrowser } from "@/components/ui/directory-browser";
import dynamic from "next/dynamic";

const ALLOWED_IMAGE_HOSTNAMES = ["googleusercontent.com", "drive.google.com"];

function isAllowedImageUrl({ src }: { src: string }): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTNAMES.some(
      (hostname) =>
        url.hostname === hostname || url.hostname.endsWith(`.${hostname}`),
    );
  } catch {
    return false;
  }
}

const FileViewer = dynamic(
  () =>
    import("@/components/ui/file-viewer").then((mod) => ({
      default: mod.FileViewer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-1">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      </div>
    ),
  },
);

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
  const { toast } = useToast();
  const [lastError, setLastError] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  // Google Drive connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const popupPollRef = useRef<number | null>(null);

  // Load saved attachment configuration from database on mount
  const loadAttachmentConfig = async () => {
    try {
      setIsLoadingAttachmentConfig(true);
      setLastError("");

      const response = await fetch(
        "/api/google-drive/settings?purpose=job_attachments",
      );
      const data = await response.json();

      if (response.ok && data.success && data.settings) {
        setAttachmentConfig({
          baseFolderId: data.settings.baseFolderId,
          driveId: data.settings.driveId,
          folderName: data.settings.folderName,
          folderPath: data.settings.folderPath,
        });
      }
    } catch (error) {
      console.error("Error loading attachment config:", error);
      setLastError("Failed to load attachment configuration");
    } finally {
      setIsLoadingAttachmentConfig(false);
    }
  };

  // Load user role
  const loadUserRole = async () => {
    try {
      const response = await fetch("/api/user/role");
      const data = await response.json();
      if (response.ok) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  // Check Google Drive connection status
  const checkConnectionStatus = async () => {
    try {
      setIsCheckingConnection(true);
      const response = await fetch("/api/google-drive/auth/status");
      const data = await response.json();

      if (response.ok && data.success) {
        setIsConnected(data.connected);
        setConnectedEmail(data.email);
        if (data.connected) {
          fetchSharedDrives();
        }
      }
    } catch (error) {
      console.error("Error checking Google Drive connection:", error);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  useEffect(() => {
    loadAttachmentConfig();
    loadUserRole();
    checkConnectionStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "google-drive-callback") return;

      const { success, email, error } = event.data.payload || {};

      if (success) {
        setIsConnected(true);
        setConnectedEmail(email);
        fetchSharedDrives();
        toast({
          title: "Connected",
          description: `Google Drive connected as ${email}`,
        });
      } else {
        setLastError(error || "Google Drive connection failed");
      }

      setIsConnecting(false);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (popupPollRef.current !== null) {
        window.clearInterval(popupPollRef.current);
        popupPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Service Account State (now used for folder browsing via OAuth)
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [selectedSharedDrive, setSelectedSharedDrive] = useState<string>("");
  const [selectedServiceFolder, setSelectedServiceFolder] =
    useState<string>("");
  const [folderContents, setFolderContents] = useState<DriveFile[]>([]);
  const [isLoadingSharedDrives, setIsLoadingSharedDrives] = useState(false);
  const [isLoadingFolderContents, setIsLoadingFolderContents] = useState(false);
  const [isServiceUploading, setIsServiceUploading] = useState(false);

  // Directory Browser State
  const [showDirectoryBrowser, setShowDirectoryBrowser] = useState(false);
  const [selectedBrowserFolder, setSelectedBrowserFolder] = useState<{
    id: string;
    name: string;
    path: string[];
  } | null>(null);

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<
    {
      id: string;
      name: string;
      webViewLink: string;
      thumbnailLink?: string;
    }[]
  >([]);
  const [viewingImage, setViewingImage] = useState<{
    id: string;
    name: string;
    url: string;
  } | null>(null);

  // Job Attachments Configuration State
  const [attachmentConfig, setAttachmentConfig] = useState<{
    baseFolderId: string;
    driveId: string;
    folderName?: string;
    folderPath?: string[];
  } | null>(null);
  const [isLoadingAttachmentConfig, setIsLoadingAttachmentConfig] =
    useState(false);
  const [isSavingAttachmentConfig, setIsSavingAttachmentConfig] =
    useState(false);

  // Connect to Google Drive via OAuth popup
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setLastError("");

      const response = await fetch("/api/google-drive/auth/connect");
      const data = await response.json();

      if (response.ok && data.success && data.authUrl) {
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          data.authUrl,
          "google-drive-auth",
          `width=${width},height=${height},left=${left},top=${top},popup=yes`,
        );

        // If popup was blocked, fall back to same-tab redirect
        if (!popup) {
          if (popupPollRef.current !== null) {
            window.clearInterval(popupPollRef.current);
            popupPollRef.current = null;
          }
          setIsConnecting(false);
          window.location.href = data.authUrl;
          return;
        }

        // Poll to detect if user closed the popup without completing
        if (popupPollRef.current !== null) {
          window.clearInterval(popupPollRef.current);
        }
        popupPollRef.current = window.setInterval(() => {
          if (popup.closed) {
            if (popupPollRef.current !== null) {
              window.clearInterval(popupPollRef.current);
              popupPollRef.current = null;
            }
            setIsConnecting(false);
          }
        }, 500);
      } else {
        setLastError(
          data.error || "Failed to initiate Google Drive connection",
        );
        setIsConnecting(false);
      }
    } catch (error) {
      console.error("Failed to connect to Google Drive:", error);
      setLastError("Failed to initiate Google Drive connection");
      setIsConnecting(false);
    }
  };

  // Disconnect from Google Drive
  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      setLastError("");

      const response = await fetch("/api/google-drive/auth/disconnect", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsConnected(false);
        setConnectedEmail(null);
        setSharedDrives([]);
        setSelectedSharedDrive("");
        setSelectedBrowserFolder(null);
        setFolderContents([]);

        toast({
          title: "Disconnected",
          description: "Google Drive has been disconnected",
        });
      } else {
        setLastError(data.error || "Failed to disconnect Google Drive");
      }
    } catch (error) {
      console.error("Failed to disconnect Google Drive:", error);
      setLastError("Failed to disconnect Google Drive");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Fetch shared drives
  const fetchSharedDrives = async () => {
    try {
      setIsLoadingSharedDrives(true);
      setLastError("");

      const response = await fetch(
        `/api/google-drive/service-account?action=list-shared-drives`,
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setSharedDrives(data.sharedDrives || []);
      } else {
        setLastError(data.error || "Failed to fetch shared drives");
      }
    } catch (error) {
      console.error("Failed to fetch shared drives:", error);
      setLastError("Failed to connect to Google Drive");
    } finally {
      setIsLoadingSharedDrives(false);
    }
  };

  const fetchFolderContents = async () => {
    const folderId = selectedBrowserFolder?.id || selectedServiceFolder;
    if (!selectedSharedDrive || !folderId) return;

    try {
      setIsLoadingFolderContents(true);
      setLastError("");

      const response = await fetch(
        `/api/google-drive/service-account?action=list-folder-contents&driveId=${selectedSharedDrive}&folderId=${folderId}`,
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setFolderContents(data.files || []);
      } else {
        setLastError(data.error || "Failed to fetch folder contents");
      }
    } catch (error) {
      console.error("Failed to fetch folder contents:", error);
      setLastError("Failed to fetch folder contents");
    } finally {
      setIsLoadingFolderContents(false);
    }
  };

  const handleServiceAccountUpload = async () => {
    const folderId = selectedBrowserFolder?.id || selectedServiceFolder;
    if (!selectedSharedDrive || !folderId) return;

    try {
      setIsServiceUploading(true);
      setLastError("");

      const timestamp = String(Date.now());
      const testContent = `test_upload,data,${timestamp}\n1,2,3\n4,5,6`;
      const fileName = `test_upload_${timestamp}.csv`;

      const uploadResponse = await fetch("/api/google-drive/service-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName,
          fileContent: testContent,
          driveId: selectedSharedDrive,
          folderId,
        }),
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResponse.ok && uploadResult.success) {
        toast({
          title: "Upload Successful",
          description: `File "${uploadResult.fileName}" uploaded to Google Drive`,
        });
        // Refresh folder contents
        await fetchFolderContents();
      } else {
        setLastError(`Upload failed: ${uploadResult.error}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setLastError("Upload failed");
    } finally {
      setIsServiceUploading(false);
    }
  };

  // Image upload handlers
  const handleImageSelect = ({ target }: ChangeEvent<HTMLInputElement>) => {
    const file = target.files?.[0];
    if (!file) return;

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGoogleDriveImageUpload = async () => {
    const folderId = selectedBrowserFolder?.id || selectedServiceFolder;
    if (!selectedImage || !selectedSharedDrive || !folderId) {
      setLastError("Please select an image, shared drive, and folder first");
      return;
    }

    try {
      setIsImageUploading(true);
      setLastError("");

      const formData = new FormData();
      formData.append("image", selectedImage);
      formData.append("driveId", selectedSharedDrive);
      formData.append("folderId", folderId);

      const uploadResponse = await fetch("/api/google-drive/upload-image", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResponse.ok && uploadResult.success) {
        setUploadedImages((prev) => [
          ...prev,
          {
            id: uploadResult.fileId,
            name: uploadResult.fileName,
            webViewLink: uploadResult.webViewLink,
            thumbnailLink: uploadResult.thumbnailLink,
          },
        ]);

        toast({
          title: "Upload Successful",
          description: "Image uploaded to Google Drive successfully!",
        });

        setSelectedImage(null);
        setImagePreview("");
      } else {
        setLastError(`Google Drive upload failed: ${uploadResult.error}`);
        console.error("Google Drive upload failed:", uploadResult);
      }
    } catch (error) {
      console.error("Google Drive upload failed:", error);
      setLastError("Google Drive upload failed");
    } finally {
      setIsImageUploading(false);
    }
  };

  const getFileUrl = async (fileId: string): Promise<string> => {
    try {
      const response = await fetch(
        `/api/google-drive/get-file?fileId=${fileId}`,
      );
      const result = await response.json();

      if (response.ok && result.success) {
        return result.fileUrl;
      } else {
        throw new Error(result.error || "Failed to get file URL");
      }
    } catch (error) {
      console.error("Failed to get file URL:", error);
      setLastError("Failed to load file from Google Drive");
      throw error;
    }
  };

  const handleViewInDrive = (fileId: string) => {
    const viewerUrl = `https://drive.google.com/file/d/${fileId}/view`;
    window.open(viewerUrl, "_blank");
  };

  // Handle directory browser folder selection
  const handleDirectoryBrowserSelect = async (
    folderId: string,
    folderName: string,
    path: string[],
  ) => {
    setSelectedBrowserFolder({ id: folderId, name: folderName, path });
    setSelectedServiceFolder("");
    setShowDirectoryBrowser(false);

    if (selectedSharedDrive && folderId) {
      await saveAttachmentConfig(
        folderId,
        selectedSharedDrive,
        folderName,
        path,
      );
    }
  };

  // Save attachment configuration to database
  const saveAttachmentConfig = async (
    baseFolderId: string,
    driveId: string,
    folderName: string,
    folderPath: string[],
  ) => {
    try {
      setIsSavingAttachmentConfig(true);
      setLastError("");

      const selectedDrive = sharedDrives.find((drive) => drive.id === driveId);
      const driveName = selectedDrive?.name || "Unknown Drive";

      const response = await fetch("/api/google-drive/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driveId,
          driveName,
          baseFolderId,
          folderName,
          folderPath,
          purpose: "job_attachments",
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const config = {
          baseFolderId,
          driveId,
          folderName,
          folderPath,
        };
        setAttachmentConfig(config);

        toast({
          title: "Configuration Saved",
          description: "Job attachments folder configuration has been saved",
        });
      } else {
        setLastError(
          `Failed to save attachment configuration: ${result.error}`,
        );
        console.error("Failed to save attachment config:", result);
      }
    } catch (error) {
      console.error("Error saving attachment config:", error);
      setLastError("Failed to save attachment configuration");
    } finally {
      setIsSavingAttachmentConfig(false);
    }
  };

  // Clear job attachments configuration
  const clearAttachmentConfig = async () => {
    try {
      setIsSavingAttachmentConfig(true);
      setLastError("");

      const response = await fetch(
        "/api/google-drive/settings?purpose=job_attachments",
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setAttachmentConfig(null);
        toast({
          title: "Configuration Cleared",
          description: "Job attachments folder configuration has been cleared",
        });
      } else {
        setLastError(
          `Failed to clear attachment configuration: ${result.error}`,
        );
        console.error("Failed to clear attachment config:", result);
      }
    } catch (error) {
      console.error("Error clearing attachment config:", error);
      setLastError("Failed to clear attachment configuration");
    } finally {
      setIsSavingAttachmentConfig(false);
    }
  };

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredPermission="manage_integrations"
        fallbackTitle="Admin Access Required"
        fallbackDescription="Only administrators can access the integrations page. This page contains sensitive system configurations."
      >
        <div className="container mx-auto p-6 max-w-6xl">
          <PageHeader pageType="integrations" />

          <Tabs
            defaultValue="google-drive"
            className="space-y-6"
            id="integrations-tabs"
          >
            <TabsList
              className="grid w-full grid-cols-2"
              id="integrations-tabs-list"
            >
              <TabsTrigger
                value="google-drive"
                className="flex items-center gap-2"
                id="google-drive-tab"
              >
                <Cloud className="h-4 w-4" />
                Google Drive
              </TabsTrigger>
              <TabsTrigger
                value="database"
                className="flex items-center gap-2"
                id="database-tab"
              >
                <Database className="h-4 w-4" />
                Database
              </TabsTrigger>
            </TabsList>

            {/* Google Drive Tab */}
            <TabsContent
              value="google-drive"
              className="space-y-6"
              id="google-drive-content"
            >
              <div className="grid gap-6">
                {/* Google Drive Connection Card */}
                <Card id="google-drive-connection-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cloud className="h-5 w-5" />
                      Google Drive Connection
                      {isCheckingConnection ? (
                        <Spinner
                          size="sm"
                          aria-label="Checking Google Drive connection"
                        />
                      ) : isConnected ? (
                        <CheckCircle
                          className="h-5 w-5 text-green-500"
                          aria-hidden="false"
                          aria-label="Google Drive connected"
                        >
                          <title>Google Drive connected</title>
                        </CheckCircle>
                      ) : (
                        <XCircle
                          className="h-5 w-5 text-gray-400"
                          aria-hidden="false"
                          aria-label="Google Drive disconnected"
                        >
                          <title>Google Drive disconnected</title>
                        </XCircle>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Connect your Google Drive account to enable file storage
                      and attachment management
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isCheckingConnection ? (
                      <div className="flex items-center gap-2 py-4">
                        <Spinner size="sm" />
                        <span className="text-sm text-muted-foreground">
                          Checking connection status...
                        </span>
                      </div>
                    ) : isConnected ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                          <Link2 className="h-5 w-5 text-green-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              Connected to Google Drive
                            </p>
                            {connectedEmail && (
                              <p className="text-xs text-green-600 dark:text-green-400">
                                Signed in as {connectedEmail}
                              </p>
                            )}
                          </div>
                          <Badge variant="default">Active</Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={fetchSharedDrives}
                            disabled={isLoadingSharedDrives}
                            id="load-shared-drives-btn"
                          >
                            {isLoadingSharedDrives ? (
                              <Spinner size="sm" className="mr-2" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {isLoadingSharedDrives
                              ? "Loading..."
                              : "Load Drives"}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            id="disconnect-google-drive-btn"
                          >
                            {isDisconnecting ? (
                              <Spinner size="sm" className="mr-2" />
                            ) : (
                              <LogOut className="h-4 w-4 mr-2" />
                            )}
                            {isDisconnecting
                              ? "Disconnecting..."
                              : "Disconnect"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                          <Link2Off className="h-5 w-5 text-orange-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                              Google Drive is not connected
                            </p>
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              Connect your Google account to enable file storage
                              for job attachments
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={handleConnect}
                          disabled={isConnecting}
                          size="lg"
                          id="connect-google-drive-btn"
                        >
                          {isConnecting ? (
                            <Spinner size="sm" className="mr-2" />
                          ) : (
                            <LogIn className="h-4 w-4 mr-2" />
                          )}
                          {isConnecting
                            ? "Connecting..."
                            : "Connect to Google Drive"}
                        </Button>

                        <p className="text-xs text-muted-foreground">
                          A Google sign-in window will appear to authorise
                          access. This connection will be used globally for all
                          users in the application.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Drive Selection Section - show when connected */}
                {isConnected && (
                  <Card id="shared-drives-card">
                    <CardHeader>
                      <CardTitle>Google Drive Storage</CardTitle>
                      <CardDescription>
                        Select a drive and folder for file storage
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">
                              Drive:
                            </label>
                            <select
                              value={selectedSharedDrive}
                              onChange={(e) =>
                                setSelectedSharedDrive(e.target.value)
                              }
                              className="flex h-10 w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                              id="shared-drive-select"
                            >
                              <option value="">Select a drive</option>
                              {sharedDrives.map((drive) => (
                                <option key={drive.id} value={drive.id}>
                                  {drive.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium">
                              Folder:
                            </label>
                            <div className="flex gap-2">
                              {selectedBrowserFolder && (
                                <div className="flex-1">
                                  <div className="flex h-10 w-full rounded border border-input bg-background px-3 py-2 text-sm items-center">
                                    <Folder className="h-4 w-4 text-blue-500 mr-2" />
                                    <span className="flex-1 truncate">
                                      {selectedBrowserFolder.path.join(" / ")}
                                    </span>
                                    {attachmentConfig &&
                                      attachmentConfig.baseFolderId ===
                                        selectedBrowserFolder.id && (
                                        <Badge
                                          variant="secondary"
                                          className="ml-2 text-xs"
                                        >
                                          <Paperclip className="h-3 w-3 mr-1" />
                                          Job Attachments
                                        </Badge>
                                      )}
                                  </div>
                                </div>
                              )}
                              <Button
                                type="button"
                                onClick={() => setShowDirectoryBrowser(true)}
                                disabled={
                                  !selectedSharedDrive ||
                                  isSavingAttachmentConfig
                                }
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
                                {isSavingAttachmentConfig
                                  ? "Saving..."
                                  : "Browse"}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={fetchFolderContents}
                            disabled={
                              !selectedSharedDrive ||
                              (!selectedServiceFolder &&
                                !selectedBrowserFolder?.id) ||
                              isLoadingFolderContents
                            }
                            id="load-folder-contents-btn"
                          >
                            {isLoadingFolderContents ? (
                              <Spinner size="sm" className="mr-2" />
                            ) : (
                              <Folder className="h-4 w-4 mr-2" />
                            )}
                            {isLoadingFolderContents
                              ? "Loading..."
                              : "Load Folder Contents"}
                          </Button>
                          <Button
                            type="button"
                            onClick={handleServiceAccountUpload}
                            disabled={
                              !selectedSharedDrive ||
                              (!selectedServiceFolder &&
                                !selectedBrowserFolder?.id) ||
                              isServiceUploading
                            }
                            id="test-upload-btn"
                          >
                            {isServiceUploading ? (
                              <Spinner size="sm" className="mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {isServiceUploading
                              ? "Uploading..."
                              : "Test Upload"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Folder Contents Section */}
                {isConnected && folderContents.length > 0 && (
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
                          <div
                            key={file.id}
                            className="flex items-center gap-2 p-2 rounded border"
                          >
                            {file.isFolder ? (
                              <Folder className="h-4 w-4 text-blue-500" />
                            ) : file.mimeType.startsWith("image/") ? (
                              <ImageIcon
                                className="h-4 w-4 text-green-500"
                                aria-label="Image file"
                              />
                            ) : file.mimeType === "application/pdf" ? (
                              <FileText
                                className="h-4 w-4 text-red-500"
                                aria-label="PDF file"
                              />
                            ) : (
                              <FileText className="h-4 w-4 text-green-500" />
                            )}
                            <span className="flex-1">{file.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {file.isFolder
                                ? "Folder"
                                : file.mimeType.split("/").pop()?.toUpperCase()}
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
                      {userRole === "admin" && (
                        <Badge variant="secondary" className="text-xs">
                          Global Admin Setting
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Configure where job attachments (runsheets, dockets,
                      delivery photos) will be stored
                      {userRole === "admin" && (
                        <span className="block mt-1 text-blue-600 dark:text-blue-400 text-xs font-medium">
                          As an admin, your configuration will apply to all
                          users across the application
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingAttachmentConfig ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner size="lg" />
                        <span className="ml-2 text-sm text-muted-foreground">
                          Loading configuration...
                        </span>
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
                              Job attachments will be organised automatically
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Storage Location:
                            </label>
                            <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border text-sm font-mono">
                              {attachmentConfig.folderPath?.join(" / ") ||
                                "No path available"}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Organisation Structure:
                            </label>
                            <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs">
                              <div className="font-mono space-y-1">
                                <div>
                                  {attachmentConfig.folderName || "Base Folder"}
                                </div>
                                <div className="ml-4">
                                  [Week Ending - DD.MM.YY]
                                </div>
                                <div className="ml-8">[Customer - Bill To]</div>
                                <div className="ml-12">
                                  DD.MM.YY_Driver_Customer_BillTo_TruckType_AttachmentType
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <AlertCircle className="h-4 w-4" />
                            <span>
                              To change the folder, select a new folder using
                              the &ldquo;Browse&rdquo; button above
                            </span>
                          </div>
                          <Button
                            type="button"
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
                            {isSavingAttachmentConfig
                              ? "Clearing..."
                              : "Clear Configuration"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded">
                            <AlertCircle className="h-6 w-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              No Configuration Set
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {isConnected
                                ? "Select a shared drive and folder above to configure job attachments storage"
                                : "Connect to Google Drive first, then select a folder for job attachments"}
                            </p>
                          </div>
                          {isConnected && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <span>
                                Use the &ldquo;Browse&rdquo; button to select a
                                folder
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Image Upload Section - only show when connected */}
                {isConnected && (
                  <Card id="image-upload-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon
                          className="h-5 w-5"
                          aria-label="Image upload"
                        />
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
                            <label className="text-sm font-medium">
                              Select Image:
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              className="flex h-10 w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                              id="image-file-input"
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={handleGoogleDriveImageUpload}
                              disabled={
                                !selectedImage ||
                                !selectedSharedDrive ||
                                (!selectedServiceFolder &&
                                  !selectedBrowserFolder?.id) ||
                                isImageUploading
                              }
                              className="w-full"
                              id="upload-to-drive-btn"
                            >
                              {isImageUploading ? (
                                <Spinner size="sm" className="mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              {isImageUploading
                                ? "Uploading..."
                                : "Upload to Drive"}
                            </Button>
                          </div>
                        </div>

                        {imagePreview && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Preview:</h4>
                            <div
                              className="border rounded-lg p-4"
                              id="image-preview-container"
                            >
                              {/* Data URLs from FileReader require a plain img tag; Next.js Image does not support arbitrary data URLs */}
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
                )}

                {/* Google Drive Uploaded Images */}
                {isConnected && uploadedImages.length > 0 && (
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
                        {uploadedImages.map((image) => {
                          const safeId = image.id
                            .replace(/[^a-z0-9-]/gi, "-")
                            .toLowerCase();
                          return (
                            <div
                              key={image.id}
                              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium truncate">
                                  {image.name}
                                </h4>
                                {image.thumbnailLink &&
                                isAllowedImageUrl({
                                  src: image.thumbnailLink,
                                }) ? (
                                  <div className="relative w-full h-32">
                                    <Image
                                      src={image.thumbnailLink}
                                      alt={image.name}
                                      fill
                                      className="object-cover rounded"
                                      sizes="(max-width: 768px) 100vw, 33vw"
                                      unoptimized
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                                    <ImageIcon
                                      className="h-8 w-8 text-muted-foreground"
                                      aria-label="No image preview"
                                    />
                                  </div>
                                )}
                                <Button
                                  type="button"
                                  onClick={() =>
                                    window.open(image.webViewLink, "_blank")
                                  }
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  id={`uploaded-image-view-${safeId}`}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View in Drive
                                </Button>
                              </div>
                            </div>
                          );
                        })}
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
            <TabsContent
              value="database"
              className="space-y-6"
              id="database-content"
            >
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
                      Database integration status and connection monitoring will
                      be available here.
                    </p>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Image Viewer Modal */}
          {viewingImage && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              id="image-viewer-modal"
            >
              <div className="bg-background rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{viewingImage.name}</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const viewerUrl = `https://drive.google.com/file/d/${viewingImage.id}/view`;
                        window.open(viewerUrl, "_blank");
                      }}
                      variant="outline"
                      size="sm"
                      id="view-in-drive-modal-btn"
                    >
                      <Cloud className="h-4 w-4 mr-2" />
                      View in Drive
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setViewingImage(null)}
                      variant="outline"
                      size="sm"
                      id="close-image-viewer-btn"
                    >
                      <XCircle
                        className="h-4 w-4"
                        aria-label="Close image viewer"
                      />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center">
                  {isAllowedImageUrl({ src: viewingImage.url }) ? (
                    <div className="relative w-full" style={{ height: "70vh" }}>
                      <Image
                        src={viewingImage.url}
                        alt={viewingImage.name}
                        fill
                        className="object-contain rounded"
                        sizes="100vw"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
                      <ImageIcon className="h-16 w-16 opacity-50" />
                      <p className="text-sm">
                        Cannot display image from unrecognised host
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const driveUrl = `https://drive.google.com/file/d/${viewingImage.id}/view`;
                          window.open(driveUrl, "_blank");
                        }}
                        id="fallback-view-in-drive-btn"
                      >
                        <Cloud className="h-4 w-4 mr-2" />
                        View in Drive
                      </Button>
                    </div>
                  )}
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

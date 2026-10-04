"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, FolderOpen, Receipt, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DirectoryBrowser } from "@/components/ui/directory-browser";
import { Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const PURPOSE = "linkt_tolls";

interface LinktFolderSettings {
  driveName: string;
  folderName: string;
  folderPath: string[];
}

/**
 * Picks the Google Drive folder this environment imports Linkt trip exports
 * from. Each environment stores its own choice in its own database.
 */
export function LinktTollsFolderCard({
  isConnected,
  driveId,
  driveName,
  onReauthRequired,
}: {
  isConnected: boolean;
  /** The shared drive selected in the Google Drive Storage card */
  driveId: string;
  driveName: string;
  onReauthRequired: () => void;
}) {
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = queryKeys.googleDrive.settings({ purpose: PURPOSE });

  const settingsQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchJson<{ settings: LinktFolderSettings | null }>({
        url: `/api/google-drive/settings?purpose=${PURPOSE}`,
        fallbackMessage: "Failed to load the Linkt folder setting",
      }),
  });
  const settings = settingsQuery.data?.settings ?? null;

  const saveSetting = async ({
    request,
    successMessage,
  }: {
    request: () => Promise<unknown>;
    successMessage: string;
  }) => {
    setIsSaving(true);
    try {
      await request();
      await queryClient.invalidateQueries({ queryKey });
      toast({ title: "Linkt folder saved", description: successMessage, variant: "success" });
    } catch (error) {
      console.error("Error saving Linkt folder setting:", error);
      toast({
        title: "Could not save the Linkt folder",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectFolder = async ({
    folderId,
    folderName,
    path,
  }: {
    folderId: string;
    folderName: string;
    path: string[];
  }) => {
    setIsBrowserOpen(false);
    await saveSetting({
      successMessage: `Linkt trips will be imported from ${path.join(" / ") || folderName}.`,
      request: () =>
        fetchJson({
          url: "/api/google-drive/settings",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              driveId,
              driveName: driveName || "Unknown Drive",
              baseFolderId: folderId,
              folderName,
              folderPath: path,
              purpose: PURPOSE,
              isGlobal: true,
            }),
          },
          fallbackMessage: "Failed to save the Linkt folder",
        }),
    });
  };

  const handleClear = () =>
    saveSetting({
      successMessage: "Linkt trips will no longer be imported from Google Drive.",
      request: () =>
        fetchJson({
          url: `/api/google-drive/settings?purpose=${PURPOSE}&isGlobal=true`,
          init: { method: "DELETE" },
          fallbackMessage: "Failed to clear the Linkt folder",
        }),
    });

  return (
    <Card id="linkt-tolls-folder-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" aria-hidden="true" />
          Linkt Tolls Folder
          {settingsQuery.isFetching && <Spinner size="sm" />}
        </CardTitle>
        <CardDescription>
          The daily GitHub Action saves Linkt trip exports to the{" "}
          <span className="font-mono">worklog/tolls</span> folder on the
          backups shared drive. Choose that folder here and the Tolls page
          imports new files from it. Each environment keeps its own setting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Importing from
              </p>
              <p className="text-xs font-mono text-green-700 dark:text-green-300 truncate">
                {settings.driveName} / {settings.folderPath.join(" / ") || settings.folderName}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No folder set. Linkt trips can still be uploaded as CSV files on the
            Tolls page.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            id="choose-linkt-folder-btn"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBrowserOpen(true)}
            disabled={!isConnected || !driveId || isSaving}
          >
            <FolderOpen className="h-4 w-4 mr-1" aria-hidden="true" />
            {settings ? "Change Folder" : "Choose Folder"}
          </Button>
          {settings && (
            <Button
              id="clear-linkt-folder-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isSaving}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <XCircle className="h-4 w-4 mr-1" aria-hidden="true" />
              Clear
            </Button>
          )}
          {(!isConnected || !driveId) && (
            <span className="text-xs text-muted-foreground">
              {isConnected
                ? "Select the shared drive in Google Drive Storage first"
                : "Connect Google Drive first"}
            </span>
          )}
        </div>
      </CardContent>

      {isBrowserOpen && (
        <DirectoryBrowser
          isOpen={isBrowserOpen}
          onClose={() => setIsBrowserOpen(false)}
          driveId={driveId}
          onSelectFolder={(folderId, folderName, path) =>
            void handleSelectFolder({ folderId, folderName, path })
          }
          onReauthRequired={onReauthRequired}
          title="Select the Linkt Tolls Folder"
          allowFileSelection={false}
          allowFolderSelection={true}
        />
      )}
    </Card>
  );
}

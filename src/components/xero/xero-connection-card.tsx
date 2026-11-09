"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link2, Loader2, RefreshCw, Unplug, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { invalidateAfterXeroChange, useXeroMutations, useXeroStatus } from "@/hooks/use-xero";
import { getErrorMessage } from "@/components/xero/xero-mapping-controls";
import {
  XERO_MAPPING_PATH,
  describeSyncResult,
  formatXeroTimestamp,
} from "@/components/xero/xero-options";
import type { XeroConnectionStatus, XeroSyncResult } from "@/lib/xero/types";

/** What the OAuth callback page posts back to this window */
export interface XeroCallbackPayload {
  success: boolean;
  tenantName: string | null;
  error: string | null;
  sync: XeroSyncResult | null;
  syncError: string | null;
}

interface SyncSummary {
  result: XeroSyncResult | null;
  error: string | null;
}

/** The payload of a "xero-callback" message, or null for any other message */
function getXeroCallbackPayload({ data }: { data: unknown }): XeroCallbackPayload | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "xero-callback" &&
    "payload" in data &&
    typeof data.payload === "object" &&
    data.payload !== null
  ) {
    return data.payload as XeroCallbackPayload;
  }
  return null;
}

function SyncSummaryAlert({ summary }: { summary: SyncSummary }) {
  return (
    <div className="space-y-2" data-testid="xero-sync-summary">
      {summary.result && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{describeSyncResult({ result: summary.result })}</AlertDescription>
        </Alert>
      )}
      {summary.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>Sync failed: {summary.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function DisconnectDialog({
  open,
  tenantName,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  tenantName: string | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent id="xero-disconnect-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
          <AlertDialogDescription>
            {tenantName ? `${tenantName} will be disconnected. ` : ""}
            Invoices will no longer show Xero item codes or contacts until Xero is connected again.
            Your mappings are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel id="xero-disconnect-cancel-btn" disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            id="xero-disconnect-confirm-btn"
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? "Disconnecting..." : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConnectedDetails({ status }: { status: XeroConnectionStatus }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Organisation</dt>
        <dd className="font-medium">{status.tenantName ?? "Unknown"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Connected</dt>
        <dd>{formatXeroTimestamp({ value: status.connectedAt })}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Last sync</dt>
        <dd>{formatXeroTimestamp({ value: status.itemsSyncedAt })}</dd>
      </div>
    </dl>
  );
}

/** Connect, sync and disconnect Xero, which supplies invoice item codes and contacts */
export function XeroConnectionCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: status, isLoading, isError, error, refetch } = useXeroStatus();
  const { requestConnect, disconnect, sync } = useXeroMutations();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const popupPollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (popupPollRef.current !== null) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  };

  const handleCallback = useEffectEvent((payload: XeroCallbackPayload) => {
    stopPolling();
    setIsConnecting(false);
    void invalidateAfterXeroChange({ queryClient });
    if (!payload.success) {
      toast({
        title: "Could not connect Xero",
        description: payload.error || "The Xero connection failed",
        variant: "destructive",
      });
      return;
    }
    setSyncSummary({ result: payload.sync, error: payload.syncError });
    toast({
      title: "Xero connected",
      description: payload.sync
        ? `Connected to ${payload.tenantName ?? "Xero"}. ${describeSyncResult({ result: payload.sync })}.`
        : `Connected to ${payload.tenantName ?? "Xero"}`,
    });
  });
  const stopPollingOnUnmount = useEffectEvent(() => stopPolling());

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = getXeroCallbackPayload({ data: event.data });
      if (payload) handleCallback(payload);
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      stopPollingOnUnmount();
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setSyncSummary(null);
    try {
      const { authUrl } = await requestConnect.mutateAsync();
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        authUrl,
        "xero-auth",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`,
      );
      if (!popup) {
        setIsConnecting(false);
        window.location.href = authUrl;
        return;
      }
      stopPolling();
      popupPollRef.current = window.setInterval(() => {
        if (popup.closed) {
          stopPolling();
          setIsConnecting(false);
        }
      }, 500);
    } catch (connectError) {
      setIsConnecting(false);
      toast({
        title: "Could not connect Xero",
        description: getErrorMessage({ error: connectError }),
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync();
      setSyncSummary({ result, error: null });
      toast({ title: "Xero synced", description: describeSyncResult({ result }) });
    } catch (syncError) {
      const message = getErrorMessage({ error: syncError });
      setSyncSummary({ result: null, error: message });
      toast({ title: "Could not sync from Xero", description: message, variant: "destructive" });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      setIsDisconnectOpen(false);
      setSyncSummary(null);
      toast({ title: "Xero disconnected", description: "Xero has been disconnected" });
    } catch (disconnectError) {
      toast({
        title: "Could not disconnect Xero",
        description: getErrorMessage({ error: disconnectError }),
        variant: "destructive",
      });
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking the Xero connection...
        </p>
      );
    }
    if (isError || !status) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {getErrorMessage({ error })}
            <Button id="xero-status-retry-btn" type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    if (!status.configured) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="space-y-2">
            <p>Xero is not configured. Set these environment variables and restart the app:</p>
            <ul className="list-disc space-y-1 pl-5" aria-label="Missing environment variables">
              {status.missingEnvVars.map((name) => (
                <li key={name}>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{name}</code>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      );
    }
    if (!status.connected) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Xero organisation to sync its items and contacts, then map them to trucks,
            companies and customers.
          </p>
          <Button
            id="xero-connect-btn"
            type="button"
            disabled={isConnecting}
            onClick={() => void handleConnect()}
          >
            {isConnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {isConnecting ? "Connecting..." : "Connect Xero"}
          </Button>
          {isConnecting && (
            <p className="text-xs text-muted-foreground">
              Sign in to Xero in the window that opened and choose your organisation.
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <ConnectedDetails status={status} />
        <div className="flex flex-wrap gap-2">
          <Button
            id="xero-sync-btn"
            type="button"
            disabled={sync.isPending || disconnect.isPending}
            onClick={() => void handleSync()}
          >
            {sync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Sync from Xero
          </Button>
          <Button id="xero-open-mapping-btn" variant="outline" asChild>
            <Link href={XERO_MAPPING_PATH}>Open mapping</Link>
          </Button>
          <Button
            id="xero-disconnect-btn"
            type="button"
            variant="outline"
            className="text-destructive"
            disabled={sync.isPending || disconnect.isPending}
            onClick={() => setIsDisconnectOpen(true)}
          >
            <Unplug className="mr-2 h-4 w-4" aria-hidden="true" />
            Disconnect
          </Button>
        </div>
        <DisconnectDialog
          open={isDisconnectOpen}
          tenantName={status.tenantName}
          isPending={disconnect.isPending}
          onOpenChange={setIsDisconnectOpen}
          onConfirm={() => void handleDisconnect()}
        />
      </div>
    );
  };

  const isConnected = status?.configured && status.connected;

  return (
    <Card id="xero-connection-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" aria-hidden="true" />
          Xero Connection
          {status &&
            (isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Xero connected" role="img" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" aria-label="Xero not connected" role="img" />
            ))}
        </CardTitle>
        <CardDescription>
          Connect Xero to show item codes and contacts on customer invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderContent()}
        {syncSummary && <SyncSummaryAlert summary={syncSummary} />}
      </CardContent>
    </Card>
  );
}

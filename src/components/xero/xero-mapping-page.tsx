"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/brand/icon-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useXeroMappings, useXeroMutations } from "@/hooks/use-xero";
import { getErrorMessage } from "@/components/xero/xero-mapping-controls";
import { XeroCompanyMappings } from "@/components/xero/xero-company-mappings";
import { XeroContactMappings } from "@/components/xero/xero-contact-mappings";
import { XeroInvoiceSettingsForm } from "@/components/xero/xero-invoice-settings-form";
import { XeroVehicleMappings } from "@/components/xero/xero-vehicle-mappings";
import {
  XERO_INTEGRATIONS_PATH,
  describeSyncResult,
  formatXeroTimestamp,
  type XeroMappingTab,
} from "@/components/xero/xero-options";
import type { XeroConnectionStatus } from "@/lib/xero/types";

export interface XeroMappingPageProps {
  /** Tab to open on, e.g. from an invoice warning link */
  initialTab: XeroMappingTab;
}

function ConnectionSummary({
  connection,
  isSyncing,
  onSync,
}: {
  connection: XeroConnectionStatus;
  isSyncing: boolean;
  onSync: () => void;
}) {
  if (!connection.configured || !connection.connected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{connection.configured ? "Xero is not connected" : "Xero is not configured"}</AlertTitle>
        <AlertDescription>
          {connection.configured ? "Connect Xero" : "Set up the Xero environment variables"} on the{" "}
          <Link id="xero-integrations-link" href={XERO_INTEGRATIONS_PATH} className="font-medium underline underline-offset-2">
            Integrations page
          </Link>{" "}
          to sync its items and contacts. Mappings saved here are kept.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            Connected to {connection.tenantName ?? "Xero"}
          </p>
          <p className="text-muted-foreground">
            Items synced {formatXeroTimestamp({ value: connection.itemsSyncedAt })} · Contacts synced{" "}
            {formatXeroTimestamp({ value: connection.contactsSyncedAt })}
          </p>
          {!connection.itemsSyncedAt && (
            <p className="text-amber-700 dark:text-amber-400">
              Items have never been synced. Sync from Xero to load the items and contacts to map.
            </p>
          )}
        </div>
        <Button id="xero-mapping-sync-btn" type="button" disabled={isSyncing} onClick={onSync}>
          {isSyncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Sync from Xero
        </Button>
      </CardContent>
    </Card>
  );
}

function XeroMappingContent({ initialTab }: XeroMappingPageProps) {
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useXeroMappings();
  const { sync } = useXeroMutations();

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync();
      toast({ title: "Xero synced", description: describeSyncResult({ result }) });
    } catch (syncError) {
      toast({
        title: "Could not sync from Xero",
        description: getErrorMessage({ error: syncError }),
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Could not load the Xero mappings</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {getErrorMessage({ error })}
          <Button id="xero-mappings-retry-btn" type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectionSummary
        connection={data.connection}
        isSyncing={sync.isPending}
        onSync={() => void handleSync()}
      />

      <Tabs defaultValue={initialTab} className="space-y-4" id="xero-mapping-tabs">
        <TabsList className="flex h-auto w-full flex-wrap justify-start" id="xero-mapping-tabs-list">
          <TabsTrigger value="trucks" id="xero-trucks-tab">
            Company trucks
          </TabsTrigger>
          <TabsTrigger value="companies" id="xero-companies-tab">
            Contractors &amp; subcontractors
          </TabsTrigger>
          <TabsTrigger value="customers" id="xero-customers-tab">
            Customers
          </TabsTrigger>
          <TabsTrigger value="settings" id="xero-settings-tab">
            Invoice settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="trucks">
          <XeroVehicleMappings vehicles={data.vehicles} items={data.items} />
        </TabsContent>
        <TabsContent value="companies">
          <XeroCompanyMappings companies={data.companies} items={data.items} />
        </TabsContent>
        <TabsContent value="customers">
          <XeroContactMappings contactMappings={data.contactMappings} contacts={data.contacts} />
        </TabsContent>
        <TabsContent value="settings">
          <XeroInvoiceSettingsForm items={data.items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Maps company trucks, contractor companies and bill to names to Xero items and contacts */
export function XeroMappingPage({ initialTab }: XeroMappingPageProps) {
  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredPermission="manage_invoices"
        fallbackTitle="Admin Access Required"
        fallbackDescription="Only administrators can manage the Xero mappings."
      >
        <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <PageHeader pageType="xero" />
          <XeroMappingContent initialTab={initialTab} />
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}

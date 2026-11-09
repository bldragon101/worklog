import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { TruckClass } from "@/lib/customer-invoices/types";
import type {
  XeroConnectionStatus,
  XeroMappingsResponse,
  XeroSettingsView,
  XeroSyncResult,
} from "@/lib/xero/types";

export interface XeroVehicleMappingInput {
  registration: string;
  itemCode: string | null;
}

export interface XeroCompanyMappingInput {
  companyName: string;
  truckClass: TruckClass;
  itemCode: string | null;
}

export interface XeroContactMappingInput {
  billTo: string;
  contactId: string | null;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Whether Xero is configured and connected, and when it was last synced */
export function fetchXeroStatus(): Promise<XeroConnectionStatus> {
  return fetchJson<XeroConnectionStatus>({
    url: "/api/xero/auth/status",
    fallbackMessage: "Failed to load the Xero connection",
  });
}

/** The synced Xero items and contacts with every mapping and its suggestion */
export function fetchXeroMappings(): Promise<XeroMappingsResponse> {
  return fetchJson<XeroMappingsResponse>({
    url: "/api/xero/mappings",
    fallbackMessage: "Failed to load the Xero mappings",
  });
}

/** The account, tax type and item codes used for invoice lines */
export function fetchXeroSettings(): Promise<XeroSettingsView> {
  return fetchJson<XeroSettingsView>({
    url: "/api/xero/settings",
    fallbackMessage: "Failed to load the Xero invoice settings",
  });
}

/** The Xero sign-in URL to open in a popup */
export function requestXeroConnectUrl(): Promise<{ authUrl: string }> {
  return fetchJson<{ authUrl: string }>({
    url: "/api/xero/auth/connect",
    fallbackMessage: "Failed to start the Xero connection",
  });
}

export function disconnectXero(): Promise<{ success: true }> {
  return fetchJson<{ success: true }>({
    url: "/api/xero/auth/disconnect",
    init: { method: "POST" },
    fallbackMessage: "Failed to disconnect Xero",
  });
}

/** Fetch the items and contacts from Xero again */
export function syncXero(): Promise<XeroSyncResult> {
  return fetchJson<XeroSyncResult>({
    url: "/api/xero/sync",
    init: { method: "POST" },
    fallbackMessage: "Failed to sync from Xero",
  });
}

function putMappings<T>({
  path,
  mappings,
  fallbackMessage,
}: {
  path: string;
  mappings: T[];
  fallbackMessage: string;
}): Promise<XeroMappingsResponse> {
  return fetchJson<XeroMappingsResponse>({
    url: `/api/xero/mappings/${path}`,
    init: { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ mappings }) },
    fallbackMessage,
  });
}

/** Map company trucks to Xero items; a null item code clears the mapping */
export function saveXeroVehicleMappings({
  mappings,
}: {
  mappings: XeroVehicleMappingInput[];
}): Promise<XeroMappingsResponse> {
  return putMappings({ path: "vehicles", mappings, fallbackMessage: "Failed to save the truck mappings" });
}

/** Map contractor and subcontractor companies to an item per truck class */
export function saveXeroCompanyMappings({
  mappings,
}: {
  mappings: XeroCompanyMappingInput[];
}): Promise<XeroMappingsResponse> {
  return putMappings({ path: "companies", mappings, fallbackMessage: "Failed to save the company mappings" });
}

/** Link bill to names to Xero contacts; a null contact clears the link */
export function saveXeroContactMappings({
  mappings,
}: {
  mappings: XeroContactMappingInput[];
}): Promise<XeroMappingsResponse> {
  return putMappings({ path: "contacts", mappings, fallbackMessage: "Failed to save the contact mappings" });
}

export function saveXeroSettings({ settings }: { settings: XeroSettingsView }): Promise<XeroSettingsView> {
  return fetchJson<XeroSettingsView>({
    url: "/api/xero/settings",
    init: { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(settings) },
    fallbackMessage: "Failed to save the Xero invoice settings",
  });
}

/**
 * Refetch everything that depends on the Xero connection or synced data:
 * the status, the mappings and the invoices (their item codes and warnings).
 */
export function invalidateAfterXeroChange({ queryClient }: { queryClient: QueryClient }) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.xero.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all }),
  ]);
}

export function useXeroStatus() {
  return useQuery({
    queryKey: queryKeys.xero.status,
    queryFn: fetchXeroStatus,
    staleTime: 30 * 1000,
  });
}

export function useXeroMappings() {
  return useQuery({
    queryKey: queryKeys.xero.mappings,
    queryFn: fetchXeroMappings,
  });
}

export function useXeroSettings() {
  return useQuery({
    queryKey: queryKeys.xero.settings,
    queryFn: fetchXeroSettings,
  });
}

/**
 * Mutations for the Xero connection and mappings. Saving mappings replaces the
 * cached mappings with the response; everything refetches the invoices.
 */
export function useXeroMutations() {
  const queryClient = useQueryClient();

  const refreshAll = () => invalidateAfterXeroChange({ queryClient });
  const refreshInvoices = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
  const onMappingsSaved = (mappings: XeroMappingsResponse) => {
    queryClient.setQueryData(queryKeys.xero.mappings, mappings);
    queryClient.setQueryData(queryKeys.xero.status, mappings.connection);
    void refreshInvoices();
  };

  const requestConnect = useMutation({ mutationFn: requestXeroConnectUrl });
  const disconnect = useMutation({ mutationFn: disconnectXero, onSettled: refreshAll });
  const sync = useMutation({ mutationFn: syncXero, onSettled: refreshAll });
  const saveVehicles = useMutation({ mutationFn: saveXeroVehicleMappings, onSuccess: onMappingsSaved });
  const saveCompanies = useMutation({ mutationFn: saveXeroCompanyMappings, onSuccess: onMappingsSaved });
  const saveContacts = useMutation({ mutationFn: saveXeroContactMappings, onSuccess: onMappingsSaved });
  const saveSettings = useMutation({
    mutationFn: saveXeroSettings,
    onSuccess: (settings: XeroSettingsView) => {
      queryClient.setQueryData(queryKeys.xero.settings, settings);
      queryClient.setQueryData<XeroMappingsResponse>(queryKeys.xero.mappings, (current) =>
        current ? { ...current, settings } : current,
      );
      void refreshInvoices();
    },
  });

  const isSavingMappings =
    saveVehicles.isPending || saveCompanies.isPending || saveContacts.isPending;

  return {
    requestConnect,
    disconnect,
    sync,
    saveVehicles,
    saveCompanies,
    saveContacts,
    saveSettings,
    isSavingMappings,
  };
}

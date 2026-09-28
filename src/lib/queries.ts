/**
 * Shared React Query definitions for resources that more than one component
 * reads. Each definition pairs a key from `queryKeys` with its fetcher, so all
 * readers of the same key agree on the cached data's shape. Components adapt
 * the data with `select` rather than transforming it in the fetcher.
 */

import { queryOptions } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { CompanySettingsForEmail, Driver, Job } from "@/lib/types";

export interface CustomerSelectOptions {
  customerOptions?: string[];
  billToOptions?: string[];
}

export interface VehicleSelectOptions {
  registrationOptions?: string[];
  truckTypeOptions?: string[];
}

export interface DriverSelectOptions {
  driverOptions?: string[];
}

export interface CustomerMappings {
  customerToBillTo?: Record<string, string>;
}

export interface VehicleMappings {
  registrationToType?: Record<string, string>;
}

export interface DriverMappings {
  driverToTruck?: Record<string, string>;
}

export interface UserRoleResponse {
  role?: string;
  userId?: string;
}

export interface QuickEditSettings {
  quickEditMinRole?: string;
}

export interface DriveFolderSettings {
  baseFolderId: string;
  driveId: string;
  folderName?: string;
  folderPath?: string[];
}

/** Company details as returned by GET /api/company-settings. */
export type CompanySettings = Partial<CompanySettingsForEmail>;

/** The company settings form's field values. */
export interface CompanySettingsFormValues {
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo: string;
  emailReplyTo: string;
}

/**
 * Map loaded company settings to form values, using empty strings for
 * missing fields.
 */
export function toCompanySettingsFormValues({
  settings,
}: {
  settings: CompanySettings | null | undefined;
}): CompanySettingsFormValues {
  return {
    companyName: settings?.companyName || "",
    companyAbn: settings?.companyAbn || "",
    companyAddress: settings?.companyAddress || "",
    companyPhone: settings?.companyPhone || "",
    companyEmail: settings?.companyEmail || "",
    companyLogo: settings?.companyLogo || "",
    emailReplyTo: settings?.emailReplyTo || "",
  };
}

/**
 * Fetch the company settings, or null when the server responds with an error.
 * Throws only when the request itself fails.
 */
export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const response = await fetch("/api/company-settings");
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as CompanySettings;
}

/** The company settings (null when they could not be read). */
export const companySettingsQuery = queryOptions({
  queryKey: queryKeys.companySettings,
  queryFn: fetchCompanySettings,
});

export const customerSelectOptionsQuery = queryOptions({
  queryKey: queryKeys.customers.selectOptions,
  queryFn: () =>
    fetchJson<CustomerSelectOptions>({ url: "/api/customers/select-options" }),
});

export const vehicleSelectOptionsQuery = queryOptions({
  queryKey: queryKeys.vehicles.selectOptions,
  queryFn: () =>
    fetchJson<VehicleSelectOptions>({ url: "/api/vehicles/select-options" }),
});

export const driverSelectOptionsQuery = queryOptions({
  queryKey: queryKeys.drivers.selectOptions,
  queryFn: () =>
    fetchJson<DriverSelectOptions>({ url: "/api/drivers/select-options" }),
});

export const customerMappingsQuery = queryOptions({
  queryKey: queryKeys.customers.mappings,
  queryFn: () => fetchJson<CustomerMappings>({ url: "/api/customers/mappings" }),
});

export const vehicleMappingsQuery = queryOptions({
  queryKey: queryKeys.vehicles.mappings,
  queryFn: () => fetchJson<VehicleMappings>({ url: "/api/vehicles/mappings" }),
});

export const driverMappingsQuery = queryOptions({
  queryKey: queryKeys.drivers.mappings,
  queryFn: () => fetchJson<DriverMappings>({ url: "/api/drivers/mappings" }),
});

/** Fetch all drivers (including archived) from GET /api/drivers. */
export function fetchDriversList(): Promise<Driver[]> {
  return fetchJson<Driver[]>({
    url: "/api/drivers",
    fallbackMessage: "Failed to fetch drivers",
  });
}

/** Fetch all jobs from GET /api/jobs. */
export async function fetchJobsList(): Promise<Job[]> {
  const data = await fetchJson<Job[]>({
    url: "/api/jobs",
    fallbackMessage: "Failed to fetch jobs",
  });
  return Array.isArray(data) ? data : [];
}

/** All drivers (including archived). */
export const driversListQuery = queryOptions({
  queryKey: queryKeys.drivers.list,
  queryFn: fetchDriversList,
});

/** All jobs. */
export const jobsListQuery = queryOptions({
  queryKey: queryKeys.jobs.list,
  queryFn: fetchJobsList,
});

/** The signed-in user's role. */
export const userRoleQuery = queryOptions({
  queryKey: queryKeys.user.role,
  queryFn: () =>
    fetchJson<UserRoleResponse>({
      url: "/api/user/role",
      fallbackMessage: "Failed to fetch user role",
    }),
});

/** The minimum role allowed to use quick edit. */
export const quickEditSettingsQuery = queryOptions({
  queryKey: queryKeys.admin.quickEditSettings,
  queryFn: () =>
    fetchJson<QuickEditSettings>({
      url: "/api/admin/quick-edit-settings",
      fallbackMessage: "Failed to fetch quick edit settings",
    }),
});

/**
 * The Google Drive folder configured for job attachments, or null when none
 * is configured (or the settings could not be read).
 */
export const jobAttachmentDriveSettingsQuery = queryOptions({
  queryKey: queryKeys.googleDrive.settings({ purpose: "job_attachments" }),
  queryFn: async (): Promise<DriveFolderSettings | null> => {
    const response = await fetch(
      "/api/google-drive/settings?purpose=job_attachments",
    );
    const data = await response.json();

    if (response.ok && data.success && data.settings) {
      return data.settings as DriveFolderSettings;
    }
    return null;
  },
});

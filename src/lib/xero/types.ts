/**
 * Client-safe types for the Xero connection and mapping APIs.
 */
import type { TruckClass } from "@/lib/customer-invoices/types";

export interface XeroConnectionStatus {
  /** False until XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_ENCRYPTION_KEY and NEXT_PUBLIC_APP_URL are set */
  configured: boolean;
  missingEnvVars: string[];
  connected: boolean;
  tenantName: string | null;
  connectedAt: string | null;
  scopes: string[];
  itemsSyncedAt: string | null;
  contactsSyncedAt: string | null;
}

export interface XeroSyncResult {
  items: number;
  contacts: number;
  itemsSyncedAt: string;
  contactsSyncedAt: string;
}

export interface XeroItemOption {
  code: string;
  name: string;
  /** From the code prefix, e.g. 12TC is crane; null for other items */
  truckClass: TruckClass | null;
  /** Codes ending in SUB are subcontractor items */
  isSubcontractor: boolean;
  salesUnitPrice: number | null;
}

export interface XeroContactOption {
  contactId: string;
  name: string;
  isCustomer: boolean;
}

export interface XeroVehicleMappingRow {
  /** Normalised registration, the mapping key */
  key: string;
  registration: string;
  description: string;
  itemCode: string | null;
  /** An item whose name contains the registration, when not mapped */
  suggestedItemCode: string | null;
  /** The mapped code is not among the synced Xero items */
  isItemMissing: boolean;
}

export interface XeroCompanyDriver {
  id: number;
  name: string;
  type: string;
  hasBusinessName: boolean;
}

export type TruckClassCodes = Record<TruckClass, string | null>;

export interface XeroCompanyMappingRow {
  /** Normalised company name, the mapping key */
  key: string;
  name: string;
  drivers: XeroCompanyDriver[];
  itemCodes: TruckClassCodes;
  suggestedItemCodes: TruckClassCodes;
  /** Truck classes whose mapped code is not among the synced Xero items */
  missingItemClasses: TruckClass[];
}

export interface XeroContactMappingRow {
  /** Normalised bill to name, the mapping key */
  key: string;
  billTo: string;
  customers: string[];
  contactId: string | null;
  contactName: string | null;
  suggestedContactId: string | null;
}

export interface XeroSettingsView {
  salesAccountCode: string;
  taxType: string;
  breakItemCode: string | null;
  eastlinkItemCode: string | null;
  citylinkItemCode: string | null;
  fuelLevyItemCode: string | null;
}

export interface XeroMappingsResponse {
  connection: XeroConnectionStatus;
  items: XeroItemOption[];
  contacts: XeroContactOption[];
  vehicles: XeroVehicleMappingRow[];
  companies: XeroCompanyMappingRow[];
  contactMappings: XeroContactMappingRow[];
  settings: XeroSettingsView;
}

import type { TruckClass } from "@/lib/customer-invoices/types";
import type {
  XeroContactOption,
  XeroItemOption,
  XeroSyncResult,
} from "@/lib/xero/types";

/** An option in a Xero item or contact combobox */
export interface XeroComboboxOption {
  value: string;
  label: string;
  /** Shown under the label, e.g. the item name */
  detail: string | null;
  /** Options are listed under their group heading, in the order given */
  group: string;
}

export const TRUCK_CLASSES: ReadonlyArray<{ truckClass: TruckClass; label: string }> = [
  { truckClass: "tray", label: "Tray" },
  { truckClass: "crane", label: "Crane" },
  { truckClass: "semi", label: "Semi" },
  { truckClass: "semiCrane", label: "Semi Crane" },
];

export const XERO_MAPPING_PATH = "/settings/admin/xero";
export const XERO_INTEGRATIONS_PATH = "/settings/admin/integrations";

export type XeroMappingTab = "trucks" | "companies" | "customers" | "settings";

export const XERO_MAPPING_TABS: readonly XeroMappingTab[] = [
  "trucks",
  "companies",
  "customers",
  "settings",
];

/** The mapping tab named by a query string value, or null */
export function parseXeroMappingTab({ value }: { value: string | null }): XeroMappingTab | null {
  return XERO_MAPPING_TABS.find((tab) => tab === value) ?? null;
}

function byCode(a: XeroItemOption, b: XeroItemOption): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true });
}

function toItemOption({ item, group }: { item: XeroItemOption; group: string }): XeroComboboxOption {
  return { value: item.code, label: item.code, detail: item.name || null, group };
}

/**
 * Items for a company truck: company (non-subcontractor) items with a truck
 * class first, then every other item.
 */
export function buildVehicleItemOptions({ items }: { items: XeroItemOption[] }): XeroComboboxOption[] {
  const sorted = [...items].sort(byCode);
  const isTruckItem = (item: XeroItemOption) => item.truckClass !== null && !item.isSubcontractor;
  return [
    ...sorted.filter(isTruckItem).map((item) => toItemOption({ item, group: "Company truck items" })),
    ...sorted
      .filter((item) => !isTruckItem(item))
      .map((item) => toItemOption({ item, group: "Other items" })),
  ];
}

/**
 * Items for one truck class of a contractor or subcontractor company:
 * subcontractor items first. `otherOptions` holds every remaining item, offered
 * behind a "Show all items" button.
 */
export function buildCompanyItemOptions({
  items,
  truckClass,
}: {
  items: XeroItemOption[];
  truckClass: TruckClass;
}): { options: XeroComboboxOption[]; otherOptions: XeroComboboxOption[] } {
  const sorted = [...items].sort(byCode);
  const ofClass = sorted.filter((item) => item.truckClass === truckClass);
  return {
    options: [
      ...ofClass
        .filter((item) => item.isSubcontractor)
        .map((item) => toItemOption({ item, group: "Subcontractor items" })),
      ...ofClass
        .filter((item) => !item.isSubcontractor)
        .map((item) => toItemOption({ item, group: "Company items" })),
    ],
    otherOptions: sorted
      .filter((item) => item.truckClass !== truckClass)
      .map((item) => toItemOption({ item, group: "Other items" })),
  };
}

/** Every item, by code */
export function buildAllItemOptions({ items }: { items: XeroItemOption[] }): XeroComboboxOption[] {
  return [...items].sort(byCode).map((item) => toItemOption({ item, group: "Items" }));
}

/** Contacts by name, customers first */
export function buildContactOptions({
  contacts,
}: {
  contacts: XeroContactOption[];
}): XeroComboboxOption[] {
  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  const toOption = ({ contact, group }: { contact: XeroContactOption; group: string }) => ({
    value: contact.contactId,
    label: contact.name,
    detail: null,
    group,
  });
  return [
    ...sorted
      .filter((contact) => contact.isCustomer)
      .map((contact) => toOption({ contact, group: "Customers" })),
    ...sorted
      .filter((contact) => !contact.isCustomer)
      .map((contact) => toOption({ contact, group: "Other contacts" })),
  ];
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A timestamp such as connectedAt in Melbourne time, or "Never" */
export function formatXeroTimestamp({ value }: { value: string | null }): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Never" : DATE_TIME_FORMAT.format(date);
}

function pluralise({ count, noun }: { count: number; noun: string }): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "Synced 120 items and 1 contact" */
export function describeSyncResult({ result }: { result: XeroSyncResult }): string {
  return `Synced ${pluralise({ count: result.items, noun: "item" })} and ${pluralise({
    count: result.contacts,
    noun: "contact",
  })}`;
}

/** Whether every word of the search appears in one of the values */
export function matchesSearch({ search, values }: { search: string; values: string[] }): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = values.join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** A kebab-case fragment for element ids */
export function toKebabId({ value }: { value: string }): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "blank"
  );
}

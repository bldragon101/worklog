import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { normaliseName } from "@/lib/customer-invoices/grouping";
import type { TruckClass } from "@/lib/customer-invoices/types";
import { normaliseRegistration } from "@/lib/tolls/toll-matching";
import { formatDriverFullName } from "@/lib/utils/driver-name";
import { getXeroConnectionStatus } from "@/lib/xero/auth";
import { getXeroCompanyName, isInvoicedByCompany } from "@/lib/xero/invoice-codes";
import { getXeroSettings } from "@/lib/xero/invoice-context";
import {
  getItemTruckClass,
  isSubcontractorItem,
  suggestCompanyItemCode,
  suggestContactId,
  suggestVehicleItemCode,
} from "@/lib/xero/item-matching";
import type {
  TruckClassCodes,
  XeroCompanyMappingRow,
  XeroContactMappingRow,
  XeroItemOption,
  XeroMappingsResponse,
  XeroSettingsView,
  XeroVehicleMappingRow,
} from "@/lib/xero/types";

export const TRUCK_CLASSES: TruckClass[] = ["tray", "crane", "semi", "semiCrane"];

function emptyClassCodes(): TruckClassCodes {
  return { tray: null, crane: null, semi: null, semiCrane: null };
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

function buildVehicleRows({
  vehicles,
  mappings,
  items,
  itemCodes,
}: {
  vehicles: Array<{ registration: string; make: string; model: string; type: string }>;
  mappings: Array<{ registration: string; itemCode: string }>;
  items: XeroItemOption[];
  itemCodes: Set<string>;
}): XeroVehicleMappingRow[] {
  const mapped = new Map(mappings.map((mapping) => [mapping.registration, mapping.itemCode]));
  const rows = new Map<string, XeroVehicleMappingRow>();

  for (const vehicle of vehicles) {
    const key = normaliseRegistration({ registration: vehicle.registration });
    if (!key || rows.has(key)) continue;
    const itemCode = mapped.get(key) ?? null;
    rows.set(key, {
      key,
      registration: vehicle.registration,
      description: [vehicle.make, vehicle.model, vehicle.type].filter(Boolean).join(" · "),
      itemCode,
      suggestedItemCode: itemCode
        ? null
        : suggestVehicleItemCode({ registration: vehicle.registration, items }),
      isItemMissing: itemCode !== null && itemCodes.size > 0 && !itemCodes.has(itemCode),
    });
  }

  for (const mapping of mappings) {
    if (rows.has(mapping.registration)) continue;
    rows.set(mapping.registration, {
      key: mapping.registration,
      registration: mapping.registration,
      description: "Not in the vehicle list",
      itemCode: mapping.itemCode,
      suggestedItemCode: null,
      isItemMissing: itemCodes.size > 0 && !itemCodes.has(mapping.itemCode),
    });
  }

  return [...rows.values()].sort((a, b) => a.registration.localeCompare(b.registration));
}

function buildCompanyRows({
  drivers,
  mappings,
  items,
  itemCodes,
}: {
  drivers: Array<{
    id: number;
    driver: string;
    lastName: string | null;
    type: string;
    businessName: string | null;
    truck: string;
  }>;
  mappings: Array<{
    companyKey: string;
    companyName: string;
    truckClass: TruckClass;
    itemCode: string;
  }>;
  items: XeroItemOption[];
  itemCodes: Set<string>;
}): XeroCompanyMappingRow[] {
  const rows = new Map<string, XeroCompanyMappingRow>();
  const rowFor = ({ key, name }: { key: string; name: string }) => {
    const existing = rows.get(key);
    if (existing) return existing;
    const row: XeroCompanyMappingRow = {
      key,
      name,
      drivers: [],
      itemCodes: emptyClassCodes(),
      suggestedItemCodes: emptyClassCodes(),
      missingItemClasses: [],
    };
    rows.set(key, row);
    return row;
  };

  for (const driver of drivers) {
    if (!isInvoicedByCompany({ type: driver.type })) continue;
    const name = getXeroCompanyName(driver);
    const key = normaliseName({ value: name });
    if (!key) continue;
    rowFor({ key, name }).drivers.push({
      id: driver.id,
      name: formatDriverFullName({ driver: driver.driver, lastName: driver.lastName }),
      type: driver.type,
      hasBusinessName: Boolean(driver.businessName?.trim()),
    });
  }

  for (const mapping of mappings) {
    const row = rowFor({ key: mapping.companyKey, name: mapping.companyName });
    row.itemCodes[mapping.truckClass] = mapping.itemCode;
    if (itemCodes.size > 0 && !itemCodes.has(mapping.itemCode)) {
      row.missingItemClasses.push(mapping.truckClass);
    }
  }

  for (const row of rows.values()) {
    for (const truckClass of TRUCK_CLASSES) {
      if (row.itemCodes[truckClass]) continue;
      row.suggestedItemCodes[truckClass] = suggestCompanyItemCode({
        companyName: row.name,
        truckClass,
        items,
      });
    }
  }

  return [...rows.values()].sort(byName);
}

function buildContactRows({
  customers,
  mappings,
  contacts,
}: {
  customers: Array<{ customer: string; billTo: string }>;
  mappings: Array<{ billToKey: string; billTo: string; contactId: string; contactName: string }>;
  contacts: Array<{ contactId: string; name: string }>;
}): XeroContactMappingRow[] {
  const mapped = new Map(mappings.map((mapping) => [mapping.billToKey, mapping]));
  const rows = new Map<string, XeroContactMappingRow>();

  for (const customer of customers) {
    const key = normaliseName({ value: customer.billTo });
    if (!key) continue;
    const existing = rows.get(key);
    if (existing) {
      if (!existing.customers.includes(customer.customer)) existing.customers.push(customer.customer);
      continue;
    }
    const mapping = mapped.get(key);
    rows.set(key, {
      key,
      billTo: customer.billTo.trim(),
      customers: [customer.customer],
      contactId: mapping?.contactId ?? null,
      contactName: mapping?.contactName ?? null,
      suggestedContactId: mapping ? null : suggestContactId({ billTo: customer.billTo, contacts }),
    });
  }

  for (const mapping of mappings) {
    if (rows.has(mapping.billToKey)) continue;
    rows.set(mapping.billToKey, {
      key: mapping.billToKey,
      billTo: mapping.billTo,
      customers: [],
      contactId: mapping.contactId,
      contactName: mapping.contactName,
      suggestedContactId: null,
    });
  }

  return [...rows.values()].sort((a, b) => a.billTo.localeCompare(b.billTo));
}

/** Everything the Xero mapping page shows, with suggestions for unmapped rows */
export async function getXeroMappings(): Promise<XeroMappingsResponse> {
  const [
    connection,
    settings,
    itemRows,
    contactRows,
    vehicles,
    vehicleMappings,
    drivers,
    companyMappings,
    customers,
    contactMappings,
  ] = await Promise.all([
    getXeroConnectionStatus(),
    getXeroSettings(),
    prisma.xeroItem.findMany({ orderBy: { code: "asc" } }),
    prisma.xeroContact.findMany({ orderBy: { name: "asc" } }),
    prisma.vehicle.findMany({
      select: { registration: true, make: true, model: true, type: true },
    }),
    prisma.xeroVehicleItemMapping.findMany({ select: { registration: true, itemCode: true } }),
    prisma.driver.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        driver: true,
        lastName: true,
        type: true,
        businessName: true,
        truck: true,
      },
      orderBy: { driver: "asc" },
    }),
    prisma.xeroCompanyItemMapping.findMany({
      select: { companyKey: true, companyName: true, truckClass: true, itemCode: true },
    }),
    prisma.customer.findMany({
      select: { customer: true, billTo: true },
      orderBy: { customer: "asc" },
    }),
    prisma.xeroContactMapping.findMany({
      select: { billToKey: true, billTo: true, contactId: true, contactName: true },
    }),
  ]);

  const items: XeroItemOption[] = itemRows
    .map((item) => ({
      code: item.code,
      name: item.name,
      truckClass: getItemTruckClass({ code: item.code }),
      isSubcontractor: isSubcontractorItem({ code: item.code }),
      salesUnitPrice: item.salesUnitPrice === null ? null : Number(item.salesUnitPrice),
    }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const itemCodes = new Set(items.map((item) => item.code));
  const contacts = contactRows.map((contact) => ({
    contactId: contact.contactId,
    name: contact.name,
    isCustomer: contact.isCustomer,
  }));

  return {
    connection,
    items,
    contacts,
    vehicles: buildVehicleRows({ vehicles, mappings: vehicleMappings, items, itemCodes }),
    companies: buildCompanyRows({ drivers, mappings: companyMappings, items, itemCodes }),
    contactMappings: buildContactRows({ customers, mappings: contactMappings, contacts }),
    settings,
  };
}

/**
 * Rejects item codes that are not among the synced Xero items. Before the
 * first sync, mappings are rejected; settings (`allowBeforeSync`) are not, so
 * the defaults can be saved.
 */
async function assertItemCodesExist({
  codes,
  allowBeforeSync = false,
}: {
  codes: string[];
  allowBeforeSync?: boolean;
}): Promise<void> {
  const wanted = [...new Set(codes)];
  if (wanted.length === 0) return;
  const [found, total] = await Promise.all([
    prisma.xeroItem.findMany({ where: { code: { in: wanted } }, select: { code: true } }),
    prisma.xeroItem.count(),
  ]);
  if (total === 0) {
    if (allowBeforeSync) return;
    throw new ApiError({
      status: 400,
      message: "Sync items from Xero before mapping item codes",
    });
  }
  const foundCodes = new Set(found.map((item) => item.code));
  const missing = wanted.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new ApiError({
      status: 400,
      message: `Item code${missing.length === 1 ? "" : "s"} not in Xero: ${missing.join(", ")}`,
    });
  }
}

export interface VehicleItemMappingInput {
  registration: string;
  /** null removes the mapping */
  itemCode: string | null;
}

export async function saveVehicleItemMappings({
  mappings,
  userId,
}: {
  mappings: VehicleItemMappingInput[];
  userId: string;
}): Promise<void> {
  const normalised = mappings.map((mapping) => ({
    registration: normaliseRegistration({ registration: mapping.registration }),
    itemCode: mapping.itemCode?.trim() || null,
  }));
  if (normalised.some((mapping) => !mapping.registration)) {
    throw new ApiError({ status: 400, message: "Each mapping needs a registration" });
  }
  await assertItemCodesExist({
    codes: normalised.flatMap((mapping) => (mapping.itemCode ? [mapping.itemCode] : [])),
  });

  await prisma.$transaction(
    normalised.map(({ registration, itemCode }) =>
      itemCode
        ? prisma.xeroVehicleItemMapping.upsert({
            where: { registration },
            create: { registration, itemCode, updatedBy: userId },
            update: { itemCode, updatedBy: userId },
          })
        : prisma.xeroVehicleItemMapping.deleteMany({ where: { registration } }),
    ),
  );
}

export interface CompanyItemMappingInput {
  companyName: string;
  truckClass: TruckClass;
  /** null removes the mapping */
  itemCode: string | null;
}

export async function saveCompanyItemMappings({
  mappings,
  userId,
}: {
  mappings: CompanyItemMappingInput[];
  userId: string;
}): Promise<void> {
  const normalised = mappings.map((mapping) => ({
    companyKey: normaliseName({ value: mapping.companyName }),
    companyName: mapping.companyName.trim().replace(/\s+/g, " "),
    truckClass: mapping.truckClass,
    itemCode: mapping.itemCode?.trim() || null,
  }));
  if (normalised.some((mapping) => !mapping.companyKey)) {
    throw new ApiError({ status: 400, message: "Each mapping needs a company name" });
  }
  await assertItemCodesExist({
    codes: normalised.flatMap((mapping) => (mapping.itemCode ? [mapping.itemCode] : [])),
  });

  await prisma.$transaction(
    normalised.map(({ companyKey, companyName, truckClass, itemCode }) =>
      itemCode
        ? prisma.xeroCompanyItemMapping.upsert({
            where: { companyKey_truckClass: { companyKey, truckClass } },
            create: { companyKey, companyName, truckClass, itemCode, updatedBy: userId },
            update: { companyName, itemCode, updatedBy: userId },
          })
        : prisma.xeroCompanyItemMapping.deleteMany({ where: { companyKey, truckClass } }),
    ),
  );
}

export interface ContactMappingInput {
  billTo: string;
  /** null removes the mapping */
  contactId: string | null;
}

export async function saveContactMappings({
  mappings,
  userId,
}: {
  mappings: ContactMappingInput[];
  userId: string;
}): Promise<void> {
  const normalised = mappings.map((mapping) => ({
    billToKey: normaliseName({ value: mapping.billTo }),
    billTo: mapping.billTo.trim().replace(/\s+/g, " "),
    contactId: mapping.contactId?.trim() || null,
  }));
  if (normalised.some((mapping) => !mapping.billToKey)) {
    throw new ApiError({ status: 400, message: "Each mapping needs a bill to name" });
  }

  const contactIds = [
    ...new Set(normalised.flatMap((mapping) => (mapping.contactId ? [mapping.contactId] : []))),
  ];
  const contacts = await prisma.xeroContact.findMany({
    where: { contactId: { in: contactIds } },
    select: { contactId: true, name: true },
  });
  const contactNames = new Map(contacts.map((contact) => [contact.contactId, contact.name]));
  const missing = contactIds.filter((contactId) => !contactNames.has(contactId));
  if (missing.length > 0) {
    throw new ApiError({
      status: 400,
      message: "A selected contact is not in Xero. Sync from Xero and try again.",
    });
  }

  await prisma.$transaction(
    normalised.map(({ billToKey, billTo, contactId }) => {
      if (!contactId) return prisma.xeroContactMapping.deleteMany({ where: { billToKey } });
      const contactName = contactNames.get(contactId) ?? "";
      return prisma.xeroContactMapping.upsert({
        where: { billToKey },
        create: { billToKey, billTo, contactId, contactName, updatedBy: userId },
        update: { billTo, contactId, contactName, updatedBy: userId },
      });
    }),
  );
}

export async function saveXeroSettings({
  settings,
  userId,
}: {
  settings: XeroSettingsView;
  userId: string;
}): Promise<XeroSettingsView> {
  await assertItemCodesExist({
    codes: [
      settings.breakItemCode,
      settings.eastlinkItemCode,
      settings.citylinkItemCode,
      settings.fuelLevyItemCode,
    ].flatMap((code) => (code ? [code] : [])),
    allowBeforeSync: true,
  });

  const existing = await prisma.xeroSettings.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  const data = { ...settings, updatedBy: userId };
  if (existing) {
    await prisma.xeroSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.xeroSettings.create({ data });
  }
  return getXeroSettings();
}

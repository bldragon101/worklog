import { prisma } from "@/lib/prisma";
import { normaliseName } from "@/lib/customer-invoices/grouping";
import {
  companyItemKey,
  DEFAULT_XERO_SETTINGS,
  getXeroCompanyName,
  type XeroDriverInfo,
  type XeroInvoiceContext,
} from "@/lib/xero/invoice-codes";
import type { XeroSettingsView } from "@/lib/xero/types";

/** The saved Xero settings, or the defaults before they are first saved */
export async function getXeroSettings(): Promise<XeroSettingsView> {
  const settings = await prisma.xeroSettings.findFirst({ orderBy: { id: "asc" } });
  if (!settings) return DEFAULT_XERO_SETTINGS;
  return {
    salesAccountCode: settings.salesAccountCode,
    taxType: settings.taxType,
    breakItemCode: settings.breakItemCode,
    eastlinkItemCode: settings.eastlinkItemCode,
    citylinkItemCode: settings.citylinkItemCode,
    fuelLevyItemCode: settings.fuelLevyItemCode,
  };
}

/**
 * Everything needed to add Xero item codes and contacts to invoices, or null
 * when Xero is not connected (invoices then show no Xero warnings).
 */
export async function loadXeroInvoiceContext(): Promise<XeroInvoiceContext | null> {
  const connection = await prisma.xeroConnection.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!connection) return null;

  const [settings, items, vehicleMappings, companyMappings, contactMappings, drivers] =
    await Promise.all([
      getXeroSettings(),
      prisma.xeroItem.findMany({ select: { code: true } }),
      prisma.xeroVehicleItemMapping.findMany({ select: { registration: true, itemCode: true } }),
      prisma.xeroCompanyItemMapping.findMany({
        select: { companyKey: true, truckClass: true, itemCode: true },
      }),
      prisma.xeroContactMapping.findMany({
        select: { billToKey: true, contactId: true, contactName: true },
      }),
      prisma.driver.findMany({
        select: {
          driver: true,
          lastName: true,
          type: true,
          businessName: true,
          truck: true,
        },
      }),
    ]);

  const driverMap = new Map<string, XeroDriverInfo>();
  for (const driver of drivers) {
    driverMap.set(normaliseName({ value: driver.driver }), {
      type: driver.type,
      companyName: getXeroCompanyName(driver),
    });
  }

  return {
    settings,
    itemCodes: new Set(items.map((item) => item.code)),
    vehicleItems: new Map(
      vehicleMappings.map((mapping) => [mapping.registration, mapping.itemCode]),
    ),
    companyItems: new Map(
      companyMappings.map((mapping) => [
        companyItemKey({ companyKey: mapping.companyKey, truckClass: mapping.truckClass }),
        mapping.itemCode,
      ]),
    ),
    contacts: new Map(
      contactMappings.map((mapping) => [
        mapping.billToKey,
        { contactId: mapping.contactId, contactName: mapping.contactName },
      ]),
    ),
    drivers: driverMap,
  };
}

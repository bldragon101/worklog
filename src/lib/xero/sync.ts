import { prisma } from "@/lib/prisma";
import { fetchXeroContacts, fetchXeroItems } from "@/lib/xero/client";
import type { XeroSyncResult } from "@/lib/xero/types";

/** Long enough to replace tens of thousands of contacts */
const SYNC_TRANSACTION_TIMEOUT_MS = 60 * 1000;

/**
 * Copies Xero's items and active contacts into the local tables, replacing
 * what was there, and records the sync time on the active connection.
 * Mappings are kept; a mapping to an item that has gone is flagged on the
 * mapping page and on invoices.
 */
export async function syncXeroItemsAndContacts(): Promise<XeroSyncResult> {
  const items = await fetchXeroItems();
  const contacts = await fetchXeroContacts();
  const syncedAt = new Date();

  const itemRows = items
    .filter((item) => item.ItemID && item.Code?.trim())
    .map((item) => ({
      itemId: item.ItemID,
      code: item.Code.trim(),
      name: item.Name?.trim() || item.Code.trim(),
      salesUnitPrice: item.SalesDetails?.UnitPrice ?? null,
      salesAccountCode: item.SalesDetails?.AccountCode ?? null,
      salesTaxType: item.SalesDetails?.TaxType ?? null,
      isSold: item.IsSold ?? true,
      syncedAt,
    }));

  const contactRows = contacts
    .filter((contact) => contact.ContactID && contact.Name?.trim())
    .map((contact) => ({
      contactId: contact.ContactID,
      name: contact.Name.trim(),
      email: contact.EmailAddress?.trim() || null,
      isCustomer: contact.IsCustomer ?? false,
      syncedAt,
    }));

  await prisma.$transaction(async (tx) => {
    await tx.xeroItem.deleteMany({});
    if (itemRows.length > 0) {
      await tx.xeroItem.createMany({ data: itemRows, skipDuplicates: true });
    }
    await tx.xeroContact.deleteMany({});
    if (contactRows.length > 0) {
      await tx.xeroContact.createMany({ data: contactRows, skipDuplicates: true });
    }
    await tx.xeroConnection.updateMany({
      where: { isActive: true },
      data: { itemsSyncedAt: syncedAt, contactsSyncedAt: syncedAt },
    });
  }, { timeout: SYNC_TRANSACTION_TIMEOUT_MS });

  return {
    items: itemRows.length,
    contacts: contactRows.length,
    itemsSyncedAt: syncedAt.toISOString(),
    contactsSyncedAt: syncedAt.toISOString(),
  };
}

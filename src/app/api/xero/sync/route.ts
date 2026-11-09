import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { syncXeroItemsAndContacts } from "@/lib/xero/sync";

/**
 * POST /api/xero/sync
 * Copies Xero's items and active contacts into the local tables
 */
export const POST = apiRoute({
  rateLimit: "export",
  auth: { permission: "manage_invoices" },
  errorMessage: "Error syncing from Xero",
  responseMessage: "Failed to sync from Xero",
  handler: async () => NextResponse.json(await syncXeroItemsAndContacts()),
});

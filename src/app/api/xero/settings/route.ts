import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { parseJsonBody } from "@/lib/customer-invoices/schemas";
import { getXeroSettings } from "@/lib/xero/invoice-context";
import { saveXeroSettings } from "@/lib/xero/mappings";
import { xeroSettingsSchema } from "@/lib/xero/schemas";

/**
 * GET /api/xero/settings
 * The account, tax type and fixed item codes used on Xero invoices
 */
export const GET = apiRoute({
  rateLimit: "settings",
  auth: { permission: "manage_invoices" },
  errorMessage: "Error fetching Xero settings",
  responseMessage: "Failed to fetch Xero settings",
  handler: async () => NextResponse.json(await getXeroSettings()),
});

/**
 * PATCH /api/xero/settings
 * Saves every Xero setting at once
 */
export const PATCH = apiRoute({
  rateLimit: "settings",
  auth: { permission: "manage_invoices" },
  errorMessage: "Error saving Xero settings",
  responseMessage: "Failed to save Xero settings",
  validationMessage: "Invalid Xero settings",
  handler: async ({ request, userId }) => {
    const settings = await parseJsonBody({ request, schema: xeroSettingsSchema });
    return NextResponse.json(await saveXeroSettings({ settings, userId }));
  },
});

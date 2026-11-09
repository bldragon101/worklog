import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { parseJsonBody } from "@/lib/customer-invoices/schemas";
import { getXeroMappings, saveContactMappings } from "@/lib/xero/mappings";
import { contactMappingsSchema } from "@/lib/xero/schemas";

/**
 * PUT /api/xero/mappings/contacts
 * Sets or removes the Xero contact invoices to each bill to name are sent to
 */
export const PUT = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Error saving Xero contact mappings",
  responseMessage: "Failed to save Xero contact mappings",
  validationMessage: "Invalid contact mappings",
  handler: async ({ request, userId }) => {
    const { mappings } = await parseJsonBody({ request, schema: contactMappingsSchema });
    await saveContactMappings({ mappings, userId });
    return NextResponse.json(await getXeroMappings());
  },
});

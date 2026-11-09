import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { parseJsonBody } from "@/lib/customer-invoices/schemas";
import { getXeroMappings, saveCompanyItemMappings } from "@/lib/xero/mappings";
import { companyItemMappingsSchema } from "@/lib/xero/schemas";

/**
 * PUT /api/xero/mappings/companies
 * Sets or removes the Xero item code of contractor and subcontractor
 * companies, per truck class
 */
export const PUT = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Error saving Xero company mappings",
  responseMessage: "Failed to save Xero company mappings",
  validationMessage: "Invalid company mappings",
  handler: async ({ request, userId }) => {
    const { mappings } = await parseJsonBody({ request, schema: companyItemMappingsSchema });
    await saveCompanyItemMappings({ mappings, userId });
    return NextResponse.json(await getXeroMappings());
  },
});

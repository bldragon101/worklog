import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { parseJsonBody } from "@/lib/customer-invoices/schemas";
import { getXeroMappings, saveVehicleItemMappings } from "@/lib/xero/mappings";
import { vehicleItemMappingsSchema } from "@/lib/xero/schemas";

/**
 * PUT /api/xero/mappings/vehicles
 * Sets or removes the Xero item code of company trucks, by registration
 */
export const PUT = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Error saving Xero vehicle mappings",
  responseMessage: "Failed to save Xero vehicle mappings",
  validationMessage: "Invalid vehicle mappings",
  handler: async ({ request, userId }) => {
    const { mappings } = await parseJsonBody({ request, schema: vehicleItemMappingsSchema });
    await saveVehicleItemMappings({ mappings, userId });
    return NextResponse.json(await getXeroMappings());
  },
});

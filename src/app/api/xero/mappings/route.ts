import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { getXeroMappings } from "@/lib/xero/mappings";

/**
 * GET /api/xero/mappings
 * Xero items, contacts and every mapping, with suggestions for unmapped rows
 */
export const GET = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Error fetching Xero mappings",
  responseMessage: "Failed to fetch Xero mappings",
  handler: async () => NextResponse.json(await getXeroMappings()),
});

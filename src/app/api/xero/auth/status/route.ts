import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { getXeroConnectionStatus } from "@/lib/xero/auth";

/**
 * GET /api/xero/auth/status
 * Whether Xero is configured and connected, and when it was last synced
 */
export const GET = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Failed to check Xero connection status",
  responseMessage: "Failed to check Xero connection status",
  handler: async () => NextResponse.json(await getXeroConnectionStatus()),
});

import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { disconnectXero } from "@/lib/xero/auth";

/**
 * POST /api/xero/auth/disconnect
 * Revokes the Xero connection; synced items, contacts and mappings are kept
 */
export const POST = apiRoute({
  auth: { permission: "manage_integrations" },
  errorMessage: "Failed to disconnect Xero",
  responseMessage: "Failed to disconnect Xero",
  errorBody: { success: false },
  handler: async () => {
    await disconnectXero();
    return NextResponse.json({ success: true });
  },
});

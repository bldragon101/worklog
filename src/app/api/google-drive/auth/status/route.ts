import { NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/google-auth";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Failed to check Google Drive connection status",
  responseMessage: "Failed to check Google Drive connection status",
  errorBody: { success: false },
  handler: async () => {
    const status = await getConnectionStatus();

    return NextResponse.json({
      success: true,
      connected: status.connected,
      email: status.email,
      expiry: status.expiry,
    });
  },
});

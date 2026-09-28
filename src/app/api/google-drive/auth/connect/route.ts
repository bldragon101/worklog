import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/permissions";
import { getAuthUrl } from "@/lib/google-auth";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Failed to generate Google Drive auth URL",
  responseMessage: "Failed to initiate Google Drive connection",
  errorBody: { success: false },
  handler: async ({ userId }) => {
    const role = await getUserRole(userId);

    if (role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only administrators can connect Google Drive",
        },
        { status: 403 },
      );
    }

    const authUrl = getAuthUrl();

    return NextResponse.json({
      success: true,
      authUrl,
    });
  },
});

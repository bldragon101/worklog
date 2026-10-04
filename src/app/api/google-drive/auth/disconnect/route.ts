import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/permissions";
import { disconnectGoogleDrive } from "@/lib/google-auth";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute({
  auth: "user",
  errorMessage: "Failed to disconnect Google Drive",
  responseMessage: "Failed to disconnect Google Drive",
  errorBody: { success: false },
  handler: async ({ userId }) => {
    const role = await getUserRole(userId);

    if (role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only administrators can disconnect Google Drive",
        },
        { status: 403 },
      );
    }

    await disconnectGoogleDrive();

    return NextResponse.json({
      success: true,
      message: "Google Drive has been disconnected successfully",
    });
  },
});

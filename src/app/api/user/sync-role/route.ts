import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/permissions";
import { clerkClient } from "@clerk/nextjs/server";
import { apiRoute } from "@/lib/api-route";

export const POST = apiRoute({
  auth: "user",
  errorMessage: "Error syncing user role",
  responseMessage: "Failed to sync user role",
  handler: async ({ userId }) => {
    // Get user role from database or environment variables
    const role = await getUserRole(userId);

    // Sync role to Clerk's public metadata
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role,
      },
    });

    return NextResponse.json({
      success: true,
      role,
      message: "Role synced to Clerk metadata successfully.",
    });
  },
});

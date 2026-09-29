import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/permissions";
import { clerkClient } from "@clerk/nextjs/server";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching user role",
  handler: async ({ userId }) => {
    // Get user role (now async)
    const role = await getUserRole(userId);

    // Update Clerk's public metadata only if role has changed (performance optimisation)
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const currentMetadataRole = user.publicMetadata?.role;

      // Only update if role differs from current metadata
      if (currentMetadataRole !== role) {
        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            role,
          },
        });
      }
    } catch (metadataError) {
      console.error("Error syncing Clerk metadata:", metadataError);
      // Non-critical error, continue anyway
    }

    return NextResponse.json({
      role,
      userId,
    });
  },
});

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserRole } from "@/lib/permissions";
import { clerkClient } from "@clerk/nextjs/server";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;

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

    return NextResponse.json(
      {
        role,
        userId,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Error fetching user role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

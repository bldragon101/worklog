import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserRole } from "@/lib/permissions";
import { clerkClient } from "@clerk/nextjs/server";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function POST(request: NextRequest) {
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

    // Get user role from database or environment variables
    const role = await getUserRole(userId);

    // Sync role to Clerk's public metadata
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role,
      },
    });

    return NextResponse.json(
      {
        success: true,
        role,
        message:
          "Role synced to Clerk metadata successfully.",
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Error syncing user role:", error);
    return NextResponse.json(
      { error: "Failed to sync user role" },
      { status: 500 },
    );
  }
}

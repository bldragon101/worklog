import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserRole } from "@/lib/permissions";
import { disconnectGoogleDrive } from "@/lib/google-auth";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { userId } = authResult;

    const role = await getUserRole(userId);

    if (role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Only administrators can disconnect Google Drive",
        },
        { status: 403, headers: rateLimitResult.headers },
      );
    }

    await disconnectGoogleDrive();

    return NextResponse.json(
      {
        success: true,
        message: "Google Drive has been disconnected successfully",
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Failed to disconnect Google Drive:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect Google Drive",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { getConnectionStatus } from "@/lib/google-auth";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const status = await getConnectionStatus();

    return NextResponse.json(
      {
        success: true,
        connected: status.connected,
        email: status.email,
        expiry: status.expiry,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Failed to check Google Drive connection status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check Google Drive connection status",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

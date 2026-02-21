import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { getUserRole } from "@/lib/permissions";
import { getAuthUrl } from "@/lib/google-auth";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
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
          error: "Only administrators can connect Google Drive",
        },
        { status: 403, headers: rateLimitResult.headers },
      );
    }

    const authUrl = getAuthUrl();

    return NextResponse.json(
      {
        success: true,
        authUrl,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Failed to generate Google Drive auth URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initiate Google Drive connection",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  try {
    const settings = await prisma.companySettings.findFirst({
      select: { signUpEnabled: true },
    });

    const enabled = settings?.signUpEnabled ?? true;

    return NextResponse.json(
      { enabled },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          ...rateLimitResult.headers,
        },
      },
    );
  } catch (error) {
    console.error(
      "Error checking sign-up status:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { enabled: false, error: "Failed to check sign-up status" },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          ...rateLimitResult.headers,
        },
      },
    );
  }
}

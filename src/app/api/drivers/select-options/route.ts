import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/api-helpers";

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

    // Fetch only the driver names for selects (exclude archived drivers)
    const drivers = await prisma.driver.findMany({
      select: {
        driver: true,
      },
      where: {
        isArchived: false,
      },
      orderBy: {
        driver: "asc",
      },
    });

    // Create unique array of driver names
    const driverOptions = drivers.map((d) => d.driver).sort();

    return NextResponse.json(
      {
        driverOptions,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Error fetching driver select options:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

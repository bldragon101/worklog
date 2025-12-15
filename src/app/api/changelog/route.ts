import { NextRequest, NextResponse } from "next/server";
import { getReleases, getCurrentVersion } from "@/lib/changelog";
// import { requireAuth } from "@/lib/auth"; // Uncomment if authentication is needed
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

// Create rate limiter for changelog endpoint
const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    // Note: For changelog, we might want to allow public access
    // If you want to require authentication, uncomment the following:
    /*
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    */

    // Get pre-generated changelog data
    const releases = getReleases();
    const currentVersion = getCurrentVersion();

    // Basic validation
    if (!Array.isArray(releases)) {
      console.error("Invalid releases format");
      return NextResponse.json(
        { releases: [], currentVersion: "1.0.0" },
        {
          headers: {
            ...rateLimitResult.headers,
            // SECURITY: Additional security headers
            "Cache-Control":
              "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        },
      );
    }

    return NextResponse.json(
      { releases, currentVersion },
      {
        headers: {
          ...rateLimitResult.headers,
          // SECURITY: Cache changelog data as it doesn't change often
          "Cache-Control":
            "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
    );
  } catch (error) {
    console.error("Error processing changelog:", error);

    // Return a safe fallback response
    return NextResponse.json(
      { releases: [], currentVersion: "1.0.0" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
    );
  }
}

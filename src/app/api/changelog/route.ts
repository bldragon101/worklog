import { NextResponse } from "next/server";
import { getReleases, getCurrentVersion } from "@/lib/changelog";
import { apiRoute } from "@/lib/api-route";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// Changelog data rarely changes, so it can be cached briefly
const CACHE_HEADERS = {
  ...SECURITY_HEADERS,
  "Cache-Control":
    "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
};

export const GET = apiRoute({
  auth: "public",
  errorMessage: "Error processing changelog",
  handler: async () => {
    try {
      // Get pre-generated changelog data
      const releases = getReleases();
      const currentVersion = getCurrentVersion();

      if (!Array.isArray(releases)) {
        console.error("Invalid releases format");
        return NextResponse.json(
          { releases: [], currentVersion: "1.0.0" },
          { headers: CACHE_HEADERS },
        );
      }

      return NextResponse.json(
        { releases, currentVersion },
        { headers: CACHE_HEADERS },
      );
    } catch (error) {
      console.error("Error processing changelog:", error);

      // Return a safe fallback response
      return NextResponse.json(
        { releases: [], currentVersion: "1.0.0" },
        {
          status: 500,
          headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store" },
        },
      );
    }
  },
});

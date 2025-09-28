import { NextResponse } from "next/server";
import { getReleases, getCurrentVersion } from "@/lib/changelog";

export async function GET() {
  try {
    // Get pre-generated changelog data
    const releases = getReleases();
    const currentVersion = getCurrentVersion();

    // Basic validation
    if (!Array.isArray(releases)) {
      console.error("Invalid releases format");
      return NextResponse.json({ releases: [], currentVersion: "1.0.0" });
    }

    return NextResponse.json({ releases, currentVersion });
  } catch (error) {
    console.error("Error processing changelog:", error);

    // Return a safe fallback response
    return NextResponse.json({ releases: [], currentVersion: "1.0.0" });
  }
}

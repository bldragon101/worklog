import { NextResponse } from "next/server";
import {
  getChangelog,
  parseChangelog,
  getCurrentVersion,
  getUserReleaseNotes,
} from "@/lib/changelog";

export async function GET() {
  try {
    // Read changelog files with proper error handling
    let changelog: string;
    let userReleaseNotes: string;

    try {
      changelog = getChangelog();
    } catch (fileError) {
      console.error("Error reading CHANGELOG.md:", fileError);
      // Return minimal valid response if file is missing
      return NextResponse.json(
        {
          releases: [],
          currentVersion: "1.0.0",
        },
        { status: 200 }, // Keep 200 for backward compatibility
      );
    }

    try {
      userReleaseNotes = getUserReleaseNotes();
    } catch {
      // User release notes are optional, continue without them
      userReleaseNotes = "";
    }

    // Parse changelog
    const releases = parseChangelog(changelog, userReleaseNotes);
    const currentVersion = getCurrentVersion(changelog);

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

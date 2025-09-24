import { NextResponse } from "next/server";
import {
  getChangelog,
  parseChangelog,
  getCurrentVersion,
} from "@/lib/changelog";

export async function GET() {
  try {
    const changelog = getChangelog();
    const releases = parseChangelog(changelog);
    const currentVersion = getCurrentVersion(changelog);

    return NextResponse.json({ releases, currentVersion });
  } catch (error) {
    console.error("Error reading changelog:", error);
    return NextResponse.json({ releases: [], currentVersion: "1.0.0" });
  }
}

import fs from "fs";
import path from "path";

export interface Release {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
  breaking: string[];
  userNotes?: {
    whatsNew?: string[];
    improvements?: string[];
  };
}

export function getChangelog(): string {
  const changelogPath = path.join(process.cwd(), "docs", "CHANGELOG.md");
  return fs.readFileSync(changelogPath, "utf8");
}

export function getUserReleaseNotes(): string {
  const releasesPath = path.join(process.cwd(), "docs", "RELEASES.md");
  try {
    return fs.readFileSync(releasesPath, "utf8");
  } catch {
    return "";
  }
}

export function parseUserReleaseNotes(
  content: string,
): Map<string, { whatsNew?: string[]; improvements?: string[] }> {
  const releaseMap = new Map<
    string,
    { whatsNew?: string[]; improvements?: string[] }
  >();

  if (!content) return releaseMap;

  // Split by version headers (## [version])
  const versionRegex = /## \[(\d+\.\d+\.\d+)\]/g;
  const matches = Array.from(content.matchAll(versionRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];

    // Get content between this version and the next
    const startIndex = match.index! + match[0].length;
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index : content.length;
    const versionContent = content.slice(startIndex, endIndex);

    const whatsNew: string[] = [];
    const improvements: string[] = [];

    // Extract What's New section
    const whatsNewMatch = versionContent.match(
      /### What's New\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (whatsNewMatch) {
      const lines = whatsNewMatch[1].split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.trim().match(/^[\-\*]/)) {
          const cleaned = line
            .replace(/^\s*[\-\*]\s*/, "")
            .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
            .trim();
          if (cleaned) whatsNew.push(cleaned);
        }
      }
    }

    // Extract Improvements section
    const improvementsMatch = versionContent.match(
      /### Improvements\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (improvementsMatch) {
      const lines = improvementsMatch[1]
        .split("\n")
        .filter((line) => line.trim());
      for (const line of lines) {
        if (line.trim().match(/^[\-\*]/)) {
          const cleaned = line
            .replace(/^\s*[\-\*]\s*/, "")
            .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
            .trim();
          if (cleaned) improvements.push(cleaned);
        }
      }
    }

    if (whatsNew.length > 0 || improvements.length > 0) {
      const notes: { whatsNew?: string[]; improvements?: string[] } = {};
      if (whatsNew.length > 0) notes.whatsNew = whatsNew;
      if (improvements.length > 0) notes.improvements = improvements;
      releaseMap.set(version, notes);
    }
  }

  return releaseMap;
}

export function getCurrentVersion(content: string): string {
  // Find the first version in the changelog (which is the latest/current version)
  const versionRegex = /## \[(\d+\.\d+\.\d+)\]/;
  const match = content.match(versionRegex);

  if (match && match[1]) {
    // Skip pre-releases and return the first stable version
    const allVersions = content.matchAll(/## \[(\d+\.\d+\.\d+(?:-[^]]*)?)\]/g);
    for (const versionMatch of allVersions) {
      const version = versionMatch[1];
      if (
        !version.includes("-pre") &&
        !version.includes("-alpha") &&
        !version.includes("-beta") &&
        !version.includes("-rc")
      ) {
        return version;
      }
    }
  }

  return "1.0.0"; // Fallback version
}

export function parseChangelog(
  content: string,
  userReleaseNotes?: string,
): Release[] {
  const releases: Release[] = [];

  // Parse user release notes if provided
  const userNotesMap = userReleaseNotes
    ? parseUserReleaseNotes(userReleaseNotes)
    : new Map();

  // Split by version headers (## [version])
  const versionRegex =
    /## \[(\d+\.\d+\.\d+(?:-[^]]*)?)\][^\n]*\((\d{4}-\d{2}-\d{2})\)/g;
  const matches = Array.from(content.matchAll(versionRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];
    const date = match[2];

    // Skip pre-releases
    if (
      version.includes("-pre") ||
      version.includes("-alpha") ||
      version.includes("-beta") ||
      version.includes("-rc")
    ) {
      continue;
    }

    // Get content between this version and the next
    const startIndex = match.index! + match[0].length;
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index : content.length;
    const versionContent = content.slice(startIndex, endIndex);

    // Parse features, bug fixes, and breaking changes
    const features: string[] = [];
    const bugFixes: string[] = [];
    const breaking: string[] = [];

    // Extract Features
    const featuresMatch = versionContent.match(
      /### Features\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (featuresMatch) {
      // Split by lines starting with * and filter out empty lines
      const lines = featuresMatch[1].split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.trim().startsWith("*")) {
          const cleaned = line.replace(/^\s*\*\s*/, "").trim();
          if (cleaned) features.push(cleaned);
        }
      }
    }

    // Extract Bug Fixes
    const bugFixesMatch = versionContent.match(
      /### Bug Fixes\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (bugFixesMatch) {
      // Split by lines starting with * and filter out empty lines
      const lines = bugFixesMatch[1].split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.trim().startsWith("*")) {
          const cleaned = line.replace(/^\s*\*\s*/, "").trim();
          if (cleaned) bugFixes.push(cleaned);
        }
      }
    }

    // Extract Breaking Changes
    const breakingMatch = versionContent.match(
      /### BREAKING CHANGES?\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (breakingMatch) {
      // Split by lines starting with * and filter out empty lines
      const lines = breakingMatch[1].split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.trim().startsWith("*")) {
          const cleaned = line.replace(/^\s*\*\s*/, "").trim();
          if (cleaned) breaking.push(cleaned);
        }
      }
    }

    // Only add releases that have actual changes
    if (features.length > 0 || bugFixes.length > 0 || breaking.length > 0) {
      const release: Release = {
        version,
        date,
        features,
        bugFixes,
        breaking,
      };

      // Add user notes if available
      const userNotes = userNotesMap.get(version);
      if (userNotes) {
        release.userNotes = userNotes;
      }

      releases.push(release);
    }
  }

  // Also check for the manual 1.0.0 release at the bottom
  const v1Match = content.match(/## \[1\.0\.0\] - (\d{4}-\d{2}-\d{2})/m);
  if (v1Match && !releases.find((r) => r.version === "1.0.0")) {
    const release: Release = {
      version: "1.0.0",
      date: v1Match[1],
      features: [
        "Initial release of WorkLog application",
        "Customer management system",
        "Job tracking with time management",
        "Work log entries",
        "Authentication with Clerk",
        "CSV import/export functionality",
        "Google Drive integration",
        "Mobile responsive design",
        "Dark/light theme support",
        "Advanced filtering capabilities",
      ],
      bugFixes: [],
      breaking: [],
    };

    // Add user notes if available
    const userNotes = userNotesMap.get("1.0.0");
    if (userNotes) {
      release.userNotes = userNotes;
    }

    releases.push(release);
  }

  return releases;
}

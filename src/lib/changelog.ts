import fs from "fs";
import path from "path";

export interface Release {
  version: string;
  date: string;
  features: string[];
  bugFixes: string[];
  breaking: string[];
}

export function getChangelog(): string {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  return fs.readFileSync(changelogPath, "utf8");
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

export function parseChangelog(content: string): Release[] {
  const releases: Release[] = [];

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
      /### Features\s*\n([\s\S]*?)(?=###|\n## |$)/m,
    );
    if (featuresMatch) {
      // Match all list items (starting with *)
      const listItems = featuresMatch[1].match(/^\* .+$/gm);
      if (listItems) {
        for (const item of listItems) {
          const cleaned = item
            .replace(/^\* /, "")
            .replace(/\([a-f0-9]{7,}\)$/, "") // Remove commit hash
            .replace(/\(\[[a-f0-9]{7,}\]\([^)]+\)\)$/, "") // Remove linked commit hash
            .trim();
          if (cleaned) features.push(cleaned);
        }
      }
    }

    // Extract Bug Fixes
    const bugFixesMatch = versionContent.match(
      /### Bug Fixes\s*\n([\s\S]*?)(?=###|\n## |$)/m,
    );
    if (bugFixesMatch) {
      // Match all list items (starting with *)
      const listItems = bugFixesMatch[1].match(/^\* .+$/gm);
      if (listItems) {
        for (const item of listItems) {
          const cleaned = item
            .replace(/^\* /, "")
            .replace(/\([a-f0-9]{7,}\)$/, "")
            .replace(/\(\[[a-f0-9]{7,}\]\([^)]+\)\)$/, "")
            .trim();
          if (cleaned) bugFixes.push(cleaned);
        }
      }
    }

    // Extract Breaking Changes
    const breakingMatch = versionContent.match(
      /### BREAKING CHANGES?\s*\n([\s\S]*?)(?=###|\n## |$)/m,
    );
    if (breakingMatch) {
      // Match all list items (starting with *)
      const listItems = breakingMatch[1].match(/^\* .+$/gm);
      if (listItems) {
        for (const item of listItems) {
          const cleaned = item
            .replace(/^\* /, "")
            .replace(/\([a-f0-9]{7,}\)$/, "")
            .replace(/\(\[[a-f0-9]{7,}\]\([^)]+\)\)$/, "")
            .trim();
          if (cleaned) breaking.push(cleaned);
        }
      }
    }

    // Only add releases that have actual changes
    if (features.length > 0 || bugFixes.length > 0 || breaking.length > 0) {
      releases.push({
        version,
        date,
        features,
        bugFixes,
        breaking,
      });
    }
  }

  // Also check for the manual 1.0.0 release at the bottom
  const v1Match = content.match(/## \[1\.0\.0\] - (\d{4}-\d{2}-\d{2})/m);
  if (v1Match && !releases.find((r) => r.version === "1.0.0")) {
    releases.push({
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
    });
  }

  return releases;
}

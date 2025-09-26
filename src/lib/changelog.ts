import fs from "fs";
import path from "path";

export interface CommitLink {
  text: string;
  hash: string;
  url: string;
}

export interface ChangelogItem {
  text: string;
  commit?: CommitLink;
}

export interface Release {
  version: string;
  date: string;
  url?: string;
  features: ChangelogItem[];
  bugFixes: ChangelogItem[];
  breaking: ChangelogItem[];
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

function parseChangelogLine(line: string): ChangelogItem {
  // Match pattern: text ([hash](url)) - markdown style commit link
  const markdownCommitPattern =
    /^(.*?)\s*\(?\[([a-zA-Z0-9]+)\]\((https?:\/\/[^\)]+)\)\)?$/;
  let match = line.match(markdownCommitPattern);

  if (match) {
    return {
      text: match[1].trim(),
      commit: {
        text: match[1].trim(),
        hash: match[2],
        url: match[3],
      },
    };
  }

  // Match pattern: text (hash) - simple parentheses style
  const simpleCommitPattern = /^(.*?)\s*\(([a-zA-Z0-9]+)\)$/;
  match = line.match(simpleCommitPattern);

  if (match) {
    return {
      text: match[1].trim(),
      commit: {
        text: match[1].trim(),
        hash: match[2],
        url: `https://github.com/commit/${match[2]}`, // Default URL
      },
    };
  }

  return { text: line };
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
  // Match version with optional URL and date
  const versionRegex =
    /## \[(\d+\.\d+\.\d+(?:-[^]]*)?)\](?:\((https?:\/\/[^\)]+)\))?\s*\((\d{4}-\d{2}-\d{2})\)/g;
  const matches = Array.from(content.matchAll(versionRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];
    const url = match[2] || undefined;
    const date = match[3];

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
    const features: ChangelogItem[] = [];
    const bugFixes: ChangelogItem[] = [];
    const breaking: ChangelogItem[] = [];

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
          if (cleaned) features.push(parseChangelogLine(cleaned));
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
          if (cleaned) bugFixes.push(parseChangelogLine(cleaned));
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
          if (cleaned) breaking.push(parseChangelogLine(cleaned));
        }
      }
    }

    // Only add releases that have actual changes
    if (features.length > 0 || bugFixes.length > 0 || breaking.length > 0) {
      const release: Release = {
        version,
        date,
        url,
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
        { text: "Initial release of WorkLog application" },
        { text: "Customer management system" },
        { text: "Job tracking with time management" },
        { text: "Work log entries" },
        { text: "Authentication with Clerk" },
        { text: "CSV import/export functionality" },
        { text: "Google Drive integration" },
        { text: "Mobile responsive design" },
        { text: "Dark/light theme support" },
        { text: "Advanced filtering capabilities" },
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

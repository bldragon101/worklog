import changelogData from "@/data/changelog.json";

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

export interface ChangelogData {
  currentVersion: string;
  releases: Release[];
  generatedAt: string;
}

// Type assertion for imported JSON data
const typedChangelogData = changelogData as ChangelogData;

/**
 * Get the current version from pre-generated data
 */
export function getCurrentVersion(): string {
  return typedChangelogData.currentVersion;
}

/**
 * Get all releases from pre-generated data
 */
export function getReleases(): Release[] {
  return typedChangelogData.releases;
}

/**
 * Get a specific release by version
 */
export function getRelease(version: string): Release | undefined {
  return typedChangelogData.releases.find((r) => r.version === version);
}

/**
 * Get the latest release
 */
export function getLatestRelease(): Release | undefined {
  return typedChangelogData.releases[0];
}

/**
 * Get when the changelog data was generated
 */
export function getGeneratedAt(): string {
  return typedChangelogData.generatedAt;
}

// Legacy functions for backward compatibility (deprecated)
/**
 * @deprecated Use getReleases() instead - this function now returns empty string
 */
export function getChangelog(): string {
  console.warn("getChangelog() is deprecated. Use getReleases() instead.");
  return "";
}

/**
 * @deprecated Use getReleases() instead - this function now returns empty string
 */
export function getUserReleaseNotes(): string {
  console.warn(
    "getUserReleaseNotes() is deprecated. User notes are now included in getReleases().",
  );
  return "";
}

/**
 * @deprecated Use getReleases() instead
 */
export function parseChangelog(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userReleaseNotes?: string,
): Release[] {
  console.warn("parseChangelog() is deprecated. Use getReleases() instead.");
  return typedChangelogData.releases;
}

/**
 * @deprecated User notes are now included in getReleases()
 */
export function parseUserReleaseNotes(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  content: string,
): Map<string, { whatsNew?: string[]; improvements?: string[] }> {
  console.warn(
    "parseUserReleaseNotes() is deprecated. User notes are now included in getReleases().",
  );
  return new Map();
}

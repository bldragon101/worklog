const fs = require("fs");
const path = require("path");

// SECURITY: Validate that paths are within the project directory
function validatePath(targetPath, basePath) {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedBase = path.resolve(basePath);

  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new Error(
      `Security Error: Path traversal attempt detected. Path ${targetPath} is outside project directory.`,
    );
  }

  return normalizedTarget;
}

// SECURITY: Sanitize input to prevent injection
function sanitizeInput(input) {
  if (typeof input !== "string") {
    return "";
  }
  // Remove any potential script tags or malicious content
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

function parseChangelogLine(line) {
  // Sanitize input line
  line = sanitizeInput(line);

  // Match pattern: text ([hash](url)) - markdown style commit link
  const markdownCommitPattern =
    /^(.*?)\s*\(?\[([a-zA-Z0-9]+)\]\((https?:\/\/[^\)]+)\)\)?$/;
  let match = line.match(markdownCommitPattern);

  if (match) {
    return {
      text: sanitizeInput(match[1].trim()),
      commit: {
        text: sanitizeInput(match[1].trim()),
        hash: match[2].substring(0, 40), // Limit hash length for security
        url: match[3].substring(0, 500), // Limit URL length for security
      },
    };
  }

  // Match pattern: text (hash) - simple parentheses style
  const simpleCommitPattern = /^(.*?)\s*\(([a-zA-Z0-9]+)\)$/;
  match = line.match(simpleCommitPattern);

  if (match) {
    return {
      text: sanitizeInput(match[1].trim()),
      commit: {
        text: sanitizeInput(match[1].trim()),
        hash: match[2].substring(0, 40), // Limit hash length for security
        url: `https://github.com/commit/${match[2].substring(0, 40)}`, // Default URL with limited hash
      },
    };
  }

  return { text: sanitizeInput(line) };
}

function parseUserReleaseNotes(content) {
  const releaseMap = new Map();

  if (!content) return releaseMap;

  // Sanitize content
  content = sanitizeInput(content);

  // Split by version headers (## [version])
  const versionRegex = /## \[(\d+\.\d+\.\d+)\]/g;
  const matches = Array.from(content.matchAll(versionRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];

    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      console.warn(`Invalid version format: ${version}`);
      continue;
    }

    // Get content between this version and the next
    const startIndex = match.index + match[0].length;
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index : content.length;
    const versionContent = content.slice(startIndex, endIndex);

    const whatsNew = [];
    const improvements = [];

    // Extract What's New section
    const whatsNewMatch = versionContent.match(
      /### What's New\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (whatsNewMatch) {
      const lines = whatsNewMatch[1].split("\n").filter((line) => line.trim());
      for (const line of lines) {
        if (line.trim().match(/^[\-\*]/)) {
          const cleaned = sanitizeInput(
            line
              .replace(/^\s*[\-\*]\s*/, "")
              .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
              .trim(),
          );
          if (cleaned && cleaned.length < 1000) {
            // Limit text length for security
            whatsNew.push(cleaned);
          }
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
          const cleaned = sanitizeInput(
            line
              .replace(/^\s*[\-\*]\s*/, "")
              .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
              .trim(),
          );
          if (cleaned && cleaned.length < 1000) {
            // Limit text length for security
            improvements.push(cleaned);
          }
        }
      }
    }

    if (whatsNew.length > 0 || improvements.length > 0) {
      const notes = {};
      if (whatsNew.length > 0) notes.whatsNew = whatsNew.slice(0, 50); // Limit array size
      if (improvements.length > 0)
        notes.improvements = improvements.slice(0, 50); // Limit array size
      releaseMap.set(version, notes);
    }
  }

  return releaseMap;
}

function parseChangelog(content, userReleaseNotes) {
  const releases = [];

  // Sanitize content
  content = sanitizeInput(content);

  // Parse user release notes if provided
  const userNotesMap = userReleaseNotes
    ? parseUserReleaseNotes(userReleaseNotes)
    : new Map();

  // Split by version headers (## [version])
  const versionRegex =
    /## \[(\d+\.\d+\.\d+(?:-[^]]*)?)\](?:\((https?:\/\/[^\)]+)\))?\s*\((\d{4}-\d{2}-\d{2})\)/g;
  const matches = Array.from(content.matchAll(versionRegex));

  // Limit to reasonable number of releases
  const maxReleases = 100;
  const processedMatches = matches.slice(0, maxReleases);

  for (let i = 0; i < processedMatches.length; i++) {
    const match = processedMatches[i];
    const version = match[1];
    const url = match[2] ? match[2].substring(0, 500) : undefined; // Limit URL length
    const date = match[3];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn(`Invalid date format: ${date}`);
      continue;
    }

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
    const startIndex = match.index + match[0].length;
    const endIndex =
      i < processedMatches.length - 1
        ? processedMatches[i + 1].index
        : content.length;
    const versionContent = content.slice(
      startIndex,
      Math.min(endIndex, startIndex + 50000),
    ); // Limit content size

    // Parse features, bug fixes, and breaking changes
    const features = [];
    const bugFixes = [];
    const breaking = [];

    // Extract Features (limit to 100 items)
    const featuresMatch = versionContent.match(
      /### Features\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (featuresMatch) {
      const lines = featuresMatch[1]
        .split("\n")
        .filter((line) => line.trim())
        .slice(0, 100);
      for (const line of lines) {
        if (line.trim().startsWith("*")) {
          const cleaned = line.replace(/^\s*\*\s*/, "").trim();
          if (cleaned) features.push(parseChangelogLine(cleaned));
        }
      }
    }

    // Extract Bug Fixes (limit to 100 items)
    const bugFixesMatch = versionContent.match(
      /### Bug Fixes\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (bugFixesMatch) {
      const lines = bugFixesMatch[1]
        .split("\n")
        .filter((line) => line.trim())
        .slice(0, 100);
      for (const line of lines) {
        if (line.trim().startsWith("*")) {
          const cleaned = line.replace(/^\s*\*\s*/, "").trim();
          if (cleaned) bugFixes.push(parseChangelogLine(cleaned));
        }
      }
    }

    // Extract Breaking Changes (limit to 50 items)
    const breakingMatch = versionContent.match(
      /### BREAKING CHANGES?\s*\n([\s\S]*?)(?=\n###|\n##|$)/,
    );
    if (breakingMatch) {
      const lines = breakingMatch[1]
        .split("\n")
        .filter((line) => line.trim())
        .slice(0, 50);
      for (const line of lines) {
        if (line.trim().startsWith("*")) {
          const cleaned = line.replace(/^\s*\*\s*/, "").trim();
          if (cleaned) breaking.push(parseChangelogLine(cleaned));
        }
      }
    }

    // Only add releases that have actual changes
    if (features.length > 0 || bugFixes.length > 0 || breaking.length > 0) {
      const release = {
        version: version.substring(0, 50), // Limit version length
        date,
        url,
        features: features.slice(0, 100),
        bugFixes: bugFixes.slice(0, 100),
        breaking: breaking.slice(0, 50),
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
    const release = {
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

  return releases.slice(0, maxReleases); // Final limit on releases
}

function getCurrentVersion(content) {
  // Sanitize content
  content = sanitizeInput(content);

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
        return version.substring(0, 50); // Limit version length
      }
    }
  }

  return "1.0.0"; // Fallback version
}

// Main generation function
function generateChangelogData() {
  console.log("Generating changelog data...");

  const projectRoot = process.cwd();

  try {
    // SECURITY: Validate all paths are within project directory
    const changelogPath = validatePath(
      path.join(projectRoot, "docs", "CHANGELOG.md"),
      projectRoot,
    );
    const releasesPath = validatePath(
      path.join(projectRoot, "docs", "RELEASES.md"),
      projectRoot,
    );
    const outputDir = validatePath(
      path.join(projectRoot, "src", "data"),
      projectRoot,
    );
    const outputPath = validatePath(
      path.join(outputDir, "changelog.json"),
      projectRoot,
    );

    // Check file existence and readability
    if (!fs.existsSync(changelogPath)) {
      throw new Error(`CHANGELOG.md not found at ${changelogPath}`);
    }

    // Read changelog with size limit (10MB max)
    const stats = fs.statSync(changelogPath);
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error("CHANGELOG.md file is too large (>10MB)");
    }

    const changelogContent = fs.readFileSync(changelogPath, "utf8");
    let userReleaseNotes = "";

    try {
      if (fs.existsSync(releasesPath)) {
        const releaseStats = fs.statSync(releasesPath);
        if (releaseStats.size > 10 * 1024 * 1024) {
          throw new Error("RELEASES.md file is too large (>10MB)");
        }
        userReleaseNotes = fs.readFileSync(releasesPath, "utf8");
      } else {
        console.log("No RELEASES.md file found, continuing without user notes");
      }
    } catch (error) {
      console.log("Warning: Could not read RELEASES.md:", error.message);
    }

    // Parse data
    const currentVersion = getCurrentVersion(changelogContent);
    const releases = parseChangelog(changelogContent, userReleaseNotes);

    // Prepare output with size validation
    const output = {
      currentVersion,
      releases: releases.slice(0, 100), // Limit to 100 releases max
      generatedAt: new Date().toISOString(),
    };

    // Validate output size (limit to 5MB)
    const outputJson = JSON.stringify(output, null, 2);
    if (outputJson.length > 5 * 1024 * 1024) {
      throw new Error("Generated changelog.json is too large (>5MB)");
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON file with proper permissions
    fs.writeFileSync(outputPath, outputJson, { mode: 0o644 });
    console.log(`Changelog data generated successfully at ${outputPath}`);
    console.log(
      `Found ${releases.length} releases, current version: ${currentVersion}`,
    );
  } catch (error) {
    console.error("Error generating changelog:", error.message);
    process.exit(1);
  }
}

// Run generation
if (require.main === module) {
  generateChangelogData();
}

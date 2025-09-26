import {
  getCurrentVersion,
  parseChangelog,
  parseUserReleaseNotes,
} from "@/lib/changelog";

describe("Changelog Utilities", () => {
  describe("getCurrentVersion", () => {
    it("should extract the current version from changelog", () => {
      const changelog = `
## [1.2.0] - 2024-01-15
### Features
- New feature

## [1.1.0] - 2024-01-10
### Bug Fixes
- Bug fix
`;
      expect(getCurrentVersion(changelog)).toBe("1.2.0");
    });

    it("should skip pre-release versions", () => {
      const changelog = `
## [1.2.0-pre.1] - 2024-01-15
### Features
- Pre-release feature

## [1.1.0] - 2024-01-10
### Bug Fixes
- Bug fix
`;
      expect(getCurrentVersion(changelog)).toBe("1.1.0");
    });

    it("should return fallback version when no valid version found", () => {
      const changelog = `
## [1.0.0-beta.1] - 2024-01-15
### Features
- Beta feature
`;
      expect(getCurrentVersion(changelog)).toBe("1.0.0");
    });
  });

  describe("parseChangelog", () => {
    it("should parse changelog with features and bug fixes", () => {
      const changelog = `
## [1.1.0](https://github.com/test/repo) (2024-01-15)

### Features

* Add new dashboard feature (abc123)
* Implement user settings (def456)

### Bug Fixes

* Fix login issue (ghi789)
* Resolve data sync problem (jkl012)
`;
      const releases = parseChangelog(changelog);

      expect(releases).toHaveLength(1);
      expect(releases[0].version).toBe("1.1.0");
      expect(releases[0].date).toBe("2024-01-15");
      expect(releases[0].features).toHaveLength(2);
      expect(releases[0].bugFixes).toHaveLength(2);
      expect(releases[0].features[0].text).toBe("Add new dashboard feature");
      expect(releases[0].features[0].commit?.hash).toBe("abc123");
      expect(releases[0].bugFixes[0].text).toBe("Fix login issue");
      expect(releases[0].bugFixes[0].commit?.hash).toBe("ghi789");
    });

    it("should parse breaking changes", () => {
      const changelog = `
## [2.0.0](https://github.com/test/repo) (2024-01-20)

### BREAKING CHANGES

* API endpoints have changed
* Database schema updated

### Features

* New architecture
`;
      const releases = parseChangelog(changelog);

      expect(releases[0].breaking).toHaveLength(2);
      expect(releases[0].breaking[0].text).toBe("API endpoints have changed");
    });

    it("should skip pre-release versions", () => {
      const changelog = `
## [1.1.0-pre.1](https://github.com/test/repo) (2024-01-15)

### Features

* Pre-release feature

## [1.0.0](https://github.com/test/repo) (2024-01-10)

### Features

* Initial release
`;
      const releases = parseChangelog(changelog);

      expect(releases).toHaveLength(1);
      expect(releases[0].version).toBe("1.0.0");
    });

    it("should merge user release notes when provided", () => {
      const changelog = `
## [1.1.0](https://github.com/test/repo) (2024-01-15)

### Features

* Technical feature implementation
`;
      const userNotes = `
## [1.1.0] - 2024-01-15

### What's New
- User-friendly feature description
- Another new capability

### Improvements
- Performance enhancement
`;
      const releases = parseChangelog(changelog, userNotes);

      expect(releases[0].userNotes).toBeDefined();
      expect(releases[0].userNotes?.whatsNew).toHaveLength(2);
      expect(releases[0].userNotes?.improvements).toHaveLength(1);
      expect(releases[0].userNotes?.whatsNew?.[0]).toBe(
        "User-friendly feature description",
      );
    });
  });

  describe("parseUserReleaseNotes", () => {
    it("should parse user release notes correctly", () => {
      const releaseNotes = `
## [1.1.0] - 2024-01-15

### What's New
- **New Feature**: Description of new feature
- Another new feature

### Improvements
- Performance improvements
- Bug fixes

## [1.0.0] - 2024-01-01

### What's New
- Initial release
`;
      const notesMap = parseUserReleaseNotes(releaseNotes);

      expect(notesMap.size).toBe(2);

      const v110 = notesMap.get("1.1.0");
      expect(v110?.whatsNew).toHaveLength(2);
      expect(v110?.improvements).toHaveLength(2);
      expect(v110?.whatsNew?.[0]).toBe(
        "New Feature: Description of new feature",
      );

      const v100 = notesMap.get("1.0.0");
      expect(v100?.whatsNew).toHaveLength(1);
      expect(v100?.whatsNew?.[0]).toBe("Initial release");
    });

    it("should handle empty or missing sections", () => {
      const releaseNotes = `
## [1.1.0] - 2024-01-15

### What's New
- New feature only

## [1.0.0] - 2024-01-01

### Improvements
- Improvements only
`;
      const notesMap = parseUserReleaseNotes(releaseNotes);

      const v110 = notesMap.get("1.1.0");
      expect(v110?.whatsNew).toHaveLength(1);
      expect(v110?.improvements).toBeUndefined();

      const v100 = notesMap.get("1.0.0");
      expect(v100?.whatsNew).toBeUndefined();
      expect(v100?.improvements).toHaveLength(1);
    });

    it("should return empty map for empty content", () => {
      const notesMap = parseUserReleaseNotes("");
      expect(notesMap.size).toBe(0);
    });
  });
});

/**
 * @jest-environment node
 */
import { GET } from "@/app/api/changelog/route";
import * as changelogLib from "@/lib/changelog";

// Mock the changelog library
jest.mock("@/lib/changelog");

describe("GET /api/changelog", () => {
  const mockChangelog = `
## [1.1.0](https://github.com/test/repo) (2024-01-15)

### Features

* Add new feature (abc123)

### Bug Fixes

* Fix bug (def456)

## [1.0.0](https://github.com/test/repo) (2024-01-01)

### Features

* Initial release
`;

  const mockUserNotes = `
## [1.1.0] - 2024-01-15

### What's New
- New feature for users

### Improvements
- Better performance

## [1.0.0] - 2024-01-01

### What's New
- Welcome to the app
`;

  const mockReleases = [
    {
      version: "1.1.0",
      date: "2024-01-15",
      features: [{ text: "Add new feature" }],
      bugFixes: [{ text: "Fix bug" }],
      breaking: [],
      userNotes: {
        whatsNew: ["New feature for users"],
        improvements: ["Better performance"],
      },
    },
    {
      version: "1.0.0",
      date: "2024-01-01",
      features: [{ text: "Initial release" }],
      bugFixes: [],
      breaking: [],
      userNotes: {
        whatsNew: ["Welcome to the app"],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return releases and current version successfully", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getChangelog.mockReturnValue(mockChangelog);
    mockedLib.getUserReleaseNotes.mockReturnValue(mockUserNotes);
    mockedLib.parseChangelog.mockReturnValue(mockReleases);
    mockedLib.getCurrentVersion.mockReturnValue("1.1.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: mockReleases,
      currentVersion: "1.1.0",
    });

    expect(mockedLib.getChangelog).toHaveBeenCalledTimes(1);
    expect(mockedLib.getUserReleaseNotes).toHaveBeenCalledTimes(1);
    expect(mockedLib.parseChangelog).toHaveBeenCalledWith(
      mockChangelog,
      mockUserNotes,
    );
    expect(mockedLib.getCurrentVersion).toHaveBeenCalledWith(mockChangelog);
  });

  it("should handle missing user release notes", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getChangelog.mockReturnValue(mockChangelog);
    mockedLib.getUserReleaseNotes.mockReturnValue(""); // Empty user notes
    mockedLib.parseChangelog.mockReturnValue([
      {
        version: "1.1.0",
        date: "2024-01-15",
        features: [{ text: "Add new feature" }],
        bugFixes: [{ text: "Fix bug" }],
        breaking: [],
      },
    ]);
    mockedLib.getCurrentVersion.mockReturnValue("1.1.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.releases[0].userNotes).toBeUndefined();
    expect(mockedLib.parseChangelog).toHaveBeenCalledWith(mockChangelog, "");
  });

  it("should handle errors gracefully", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getChangelog.mockImplementation(() => {
      throw new Error("File not found");
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: [],
      currentVersion: "1.0.0",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error reading changelog:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should parse changelog with only technical details", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;
    const technicalOnly = `
## [1.2.0](https://github.com/test/repo) (2024-02-01)

### Features

* Technical implementation details
* Another technical feature

### Bug Fixes

* Fixed technical issue
`;

    mockedLib.getChangelog.mockReturnValue(technicalOnly);
    mockedLib.getUserReleaseNotes.mockReturnValue(""); // No user notes
    mockedLib.parseChangelog.mockReturnValue([
      {
        version: "1.2.0",
        date: "2024-02-01",
        features: [
          { text: "Technical implementation details" },
          { text: "Another technical feature" },
        ],
        bugFixes: [{ text: "Fixed technical issue" }],
        breaking: [],
      },
    ]);
    mockedLib.getCurrentVersion.mockReturnValue("1.2.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentVersion).toBe("1.2.0");
    expect(data.releases).toHaveLength(1);
    expect(data.releases[0].features).toHaveLength(2);
    expect(data.releases[0].userNotes).toBeUndefined();
  });

  it("should handle breaking changes correctly", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;
    const changelogWithBreaking = `
## [2.0.0](https://github.com/test/repo) (2024-03-01)

### BREAKING CHANGES

* API has changed
* Database schema updated

### Features

* Major rewrite
`;

    mockedLib.getChangelog.mockReturnValue(changelogWithBreaking);
    mockedLib.getUserReleaseNotes.mockReturnValue("");
    mockedLib.parseChangelog.mockReturnValue([
      {
        version: "2.0.0",
        date: "2024-03-01",
        features: [{ text: "Major rewrite" }],
        bugFixes: [],
        breaking: [
          { text: "API has changed" },
          { text: "Database schema updated" },
        ],
      },
    ]);
    mockedLib.getCurrentVersion.mockReturnValue("2.0.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.releases[0].breaking).toHaveLength(2);
    expect(data.releases[0].breaking[0].text).toBe("API has changed");
    expect(data.releases[0].breaking[1].text).toBe("Database schema updated");
  });

  it("should return empty releases when changelog is empty", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getChangelog.mockReturnValue("");
    mockedLib.getUserReleaseNotes.mockReturnValue("");
    mockedLib.parseChangelog.mockReturnValue([]);
    mockedLib.getCurrentVersion.mockReturnValue("1.0.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: [],
      currentVersion: "1.0.0",
    });
  });
});

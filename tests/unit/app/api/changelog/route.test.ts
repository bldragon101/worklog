/**
 * @jest-environment node
 */
import { GET } from "@/app/api/changelog/route";
import * as changelogLib from "@/lib/changelog";

// Mock the changelog library
jest.mock("@/lib/changelog");

describe("GET /api/changelog", () => {
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

    mockedLib.getReleases.mockReturnValue(mockReleases);
    mockedLib.getCurrentVersion.mockReturnValue("1.1.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: mockReleases,
      currentVersion: "1.1.0",
    });

    expect(mockedLib.getReleases).toHaveBeenCalledTimes(1);
    expect(mockedLib.getCurrentVersion).toHaveBeenCalledTimes(1);
  });

  it("should handle missing releases gracefully", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getReleases.mockReturnValue([]);
    mockedLib.getCurrentVersion.mockReturnValue("1.0.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: [],
      currentVersion: "1.0.0",
    });
  });

  it("should handle errors gracefully", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    mockedLib.getReleases.mockImplementation(() => {
      throw new Error("Failed to read changelog");
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: [],
      currentVersion: "1.0.0",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error processing changelog:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("should handle invalid releases format", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    // Mock getReleases to return non-array
    mockedLib.getReleases.mockReturnValue("invalid" as any);
    mockedLib.getCurrentVersion.mockReturnValue("1.2.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      releases: [],
      currentVersion: "1.0.0",
    });

    expect(consoleSpy).toHaveBeenCalledWith("Invalid releases format");
    consoleSpy.mockRestore();
  });

  it("should return releases with breaking changes", async () => {
    const releasesWithBreaking = [
      {
        version: "2.0.0",
        date: "2024-02-01",
        features: [{ text: "New major feature" }],
        bugFixes: [],
        breaking: [
          { text: "API has changed" },
          { text: "Database schema updated" },
        ],
        userNotes: {
          whatsNew: ["Major update"],
        },
      },
    ];

    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getReleases.mockReturnValue(releasesWithBreaking);
    mockedLib.getCurrentVersion.mockReturnValue("2.0.0");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.releases[0].breaking).toHaveLength(2);
    expect(data.releases[0].breaking[0].text).toBe("API has changed");
    expect(data.releases[0].breaking[1].text).toBe("Database schema updated");
  });
});

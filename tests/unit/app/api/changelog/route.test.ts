/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/changelog/route";
import * as changelogLib from "@/lib/changelog";

// Mock the changelog library
jest.mock("@/lib/changelog");

// Mock the auth and rate limiting
jest.mock("@/lib/auth");
jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    },
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

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

  // Helper to create mock NextRequest
  const createMockRequest = (url = "http://localhost:3000/api/changelog") => {
    return new NextRequest(url);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return releases and current version successfully", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getReleases.mockReturnValue(mockReleases);
    mockedLib.getCurrentVersion.mockReturnValue("1.1.0");

    const request = createMockRequest();
    const response = await GET(request);
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

    const request = createMockRequest();
    const response = await GET(request);
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

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
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
    mockedLib.getReleases.mockReturnValue(
      "invalid" as unknown as typeof mockReleases,
    );
    mockedLib.getCurrentVersion.mockReturnValue("1.2.0");

    const request = createMockRequest();
    const response = await GET(request);
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

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.releases[0].breaking).toHaveLength(2);
    expect(data.releases[0].breaking[0].text).toBe("API has changed");
    expect(data.releases[0].breaking[1].text).toBe("Database schema updated");
  });

  it("should include security headers in response", async () => {
    const mockedLib = changelogLib as jest.Mocked<typeof changelogLib>;

    mockedLib.getReleases.mockReturnValue(mockReleases);
    mockedLib.getCurrentVersion.mockReturnValue("1.1.0");

    const request = createMockRequest();
    const response = await GET(request);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Cache-Control")).toContain("public");
  });
});

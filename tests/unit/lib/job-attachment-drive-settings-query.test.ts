/**
 * @vitest-environment node
 */
import { QueryClient } from "@tanstack/react-query";
import { jobAttachmentDriveSettingsQuery } from "@/lib/queries";

const mockFetch = vi.fn<typeof fetch>();

function runQuery() {
  return new QueryClient().fetchQuery(jobAttachmentDriveSettingsQuery);
}

describe("jobAttachmentDriveSettingsQuery", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the configured folder settings", async () => {
    const settings = { baseFolderId: "base", driveId: "drive" };
    mockFetch.mockResolvedValue(
      Response.json({ success: true, settings }, { status: 200 }),
    );

    await expect(runQuery()).resolves.toEqual(settings);
  });

  it("returns null for an error response with a non-JSON body", async () => {
    mockFetch.mockResolvedValue(
      new Response("<html>Internal Server Error</html>", { status: 500 }),
    );

    await expect(runQuery()).resolves.toBeNull();
  });

  it("returns null when an ok response body is not JSON", async () => {
    mockFetch.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(runQuery()).resolves.toBeNull();
  });
});

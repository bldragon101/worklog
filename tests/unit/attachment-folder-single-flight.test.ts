const mockGoogleDriveClient = {
  files: {
    list: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("@/lib/google-auth", () => ({
  createGoogleDriveClient: jest.fn(async () => mockGoogleDriveClient),
}));

import { getOrCreateJobFolderStructure } from "@/lib/utils/attachment-utils";
import { folderCache } from "@/lib/folder-cache";

describe("getOrCreateJobFolderStructure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    folderCache.clearCache();
  });

  it("reuses in-flight folder creation for concurrent requests", async () => {
    type ListResult = { data: { files: Array<{ id: string; name?: string }> } };

    let resolveWeekFolderLookup: ((value: ListResult) => void) | undefined;
    const pendingWeekFolderLookup = new Promise<ListResult>((resolve) => {
      resolveWeekFolderLookup = resolve;
    });

    mockGoogleDriveClient.files.list
      .mockImplementationOnce(async () => pendingWeekFolderLookup)
      .mockResolvedValueOnce({ data: { files: [] } });

    mockGoogleDriveClient.files.create
      .mockResolvedValueOnce({ data: { id: "week-folder-id" } })
      .mockResolvedValueOnce({ data: { id: "customer-folder-id" } });

    const firstCall = getOrCreateJobFolderStructure({
      job: {
        date: "2026-04-20",
        customer: "Acme",
        billTo: "Acme",
      },
      baseFolderId: "base-folder-id",
      driveId: "drive-id",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const secondCall = getOrCreateJobFolderStructure({
      job: {
        date: "2026-04-20",
        customer: "Acme",
        billTo: "Acme",
      },
      baseFolderId: "base-folder-id",
      driveId: "drive-id",
    });

    resolveWeekFolderLookup?.({ data: { files: [] } });

    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);

    expect(firstResult).toEqual({
      weekFolderId: "week-folder-id",
      customerFolderId: "customer-folder-id",
    });
    expect(secondResult).toEqual(firstResult);
    expect(mockGoogleDriveClient.files.list).toHaveBeenCalledTimes(2);
    expect(mockGoogleDriveClient.files.create).toHaveBeenCalledTimes(2);
  });
});

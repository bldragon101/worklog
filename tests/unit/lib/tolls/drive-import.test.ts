/**
 * @vitest-environment node
 */
import { importNewTollFilesFromDrive } from "@/lib/tolls/drive-import";

const mocks = vi.hoisted(() => ({
  prisma: {
    googleDriveSettings: { findFirst: vi.fn() },
    tollDriveCheck: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tollImport: { findMany: vi.fn() },
  },
  drive: { files: { list: vi.fn(), get: vi.fn() } },
  importTollTrips: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/google-auth", () => ({
  createGoogleDriveClient: vi.fn(async () => mocks.drive),
}));
vi.mock("@/lib/tolls/import-toll-trips", () => ({
  importTollTrips: mocks.importTollTrips,
}));

const CSV = [
  "Trip Start date,Trip Details,LPN,Tag Number,Vehicle Class,Trip Cost,Trip End date",
  "02/10/2026 14:57,Punt Rd to Monash Fwy/Toorak Rd,1EA6QC,221101895540,HCV,-$20.44,02/10/2026 14:59",
  "Total of 1 results exported",
].join("\n");

const SETTINGS = {
  driveId: "shared-drive-id",
  baseFolderId: "folder-id",
  folderName: "linkt-tolls",
  folderPath: ["Backups", "linkt-tolls"],
};

describe("importNewTollFilesFromDrive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.googleDriveSettings.findFirst.mockResolvedValue(SETTINGS);
    mocks.prisma.tollDriveCheck.upsert.mockResolvedValue({});
    mocks.prisma.tollImport.findMany.mockResolvedValue([{ driveFileId: "old-file" }]);
    mocks.drive.files.list.mockResolvedValue({
      data: {
        files: [
          { id: "old-file", name: "linkt-trips_old.csv" },
          { id: "new-file", name: "linkt-trips_new.csv" },
          { id: "notes", name: "readme.txt" },
        ],
      },
    });
    mocks.drive.files.get.mockResolvedValue({ data: CSV });
    mocks.importTollTrips.mockResolvedValue({ inserted: 1, duplicates: 0 });
  });

  it("does nothing when no Linkt folder is set", async () => {
    mocks.prisma.googleDriveSettings.findFirst.mockResolvedValue(null);

    await expect(importNewTollFilesFromDrive({ force: true })).resolves.toEqual({
      status: "not-configured",
    });
    expect(mocks.drive.files.list).not.toHaveBeenCalled();
  });

  it("imports only CSV files this environment has not imported", async () => {
    const result = await importNewTollFilesFromDrive({ force: true, createdBy: "user_1" });

    expect(mocks.drive.files.get).toHaveBeenCalledTimes(1);
    expect(mocks.drive.files.get).toHaveBeenCalledWith(
      { fileId: "new-file", alt: "media", supportsAllDrives: true },
      { responseType: "text" },
    );
    expect(mocks.importTollTrips).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "drive",
        fileName: "linkt-trips_new.csv",
        driveFileId: "new-file",
        createdBy: "user_1",
      }),
    );
    expect(mocks.importTollTrips.mock.calls[0][0].trips).toHaveLength(1);
    expect(result).toMatchObject({
      status: "imported",
      folder: "Backups / linkt-tolls",
      files: [{ fileId: "new-file", inserted: 1, duplicates: 0, errors: [] }],
    });
  });

  it("skips the check when another one ran within the hour", async () => {
    const checkedAt = new Date("2026-10-04T08:00:00.000Z");
    mocks.prisma.tollDriveCheck.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.tollDriveCheck.findUnique.mockResolvedValue({ id: 1, checkedAt });

    await expect(importNewTollFilesFromDrive({ force: false })).resolves.toEqual({
      status: "checked-recently",
      checkedAt: checkedAt.toISOString(),
    });
    expect(mocks.drive.files.list).not.toHaveBeenCalled();
  });

  it("checks on the first page load ever", async () => {
    mocks.prisma.tollDriveCheck.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.tollDriveCheck.findUnique.mockResolvedValue(null);
    mocks.prisma.tollDriveCheck.create.mockResolvedValue({});

    const result = await importNewTollFilesFromDrive({ force: false });

    expect(result.status).toBe("imported");
    expect(mocks.drive.files.list).toHaveBeenCalled();
  });
});

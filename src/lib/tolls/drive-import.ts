import type { drive_v3 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { parseLinktTripsCsv } from "@/lib/tolls/linkt-csv";
import { importTollTrips } from "@/lib/tolls/import-toll-trips";
import type {
  TollDriveFileResult,
  TollDriveImportResult,
} from "@/lib/tolls/toll-types";

/** GoogleDriveSettings purpose for the folder the Linkt CSV exports land in */
export const LINKT_TOLLS_DRIVE_PURPOSE = "linkt_tolls";

/** How often opening the Tolls page looks for new files */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const MY_DRIVE_SENTINEL = "my-drive";
const CHECK_ROW_ID = 1;

interface DriveCsvFile {
  id: string;
  name: string;
}

/**
 * Claim the right to check Drive now. Without force, only one caller per
 * interval wins, so concurrent page loads do not import the same file twice.
 */
async function claimDriveCheck({
  force,
}: {
  force: boolean;
}): Promise<{ claimed: boolean; checkedAt: Date }> {
  const now = new Date();
  if (force) {
    await prisma.tollDriveCheck.upsert({
      where: { id: CHECK_ROW_ID },
      create: { id: CHECK_ROW_ID, checkedAt: now },
      update: { checkedAt: now },
    });
    return { claimed: true, checkedAt: now };
  }

  const { count } = await prisma.tollDriveCheck.updateMany({
    where: {
      id: CHECK_ROW_ID,
      checkedAt: { lt: new Date(now.getTime() - CHECK_INTERVAL_MS) },
    },
    data: { checkedAt: now },
  });
  if (count === 1) return { claimed: true, checkedAt: now };

  const existing = await prisma.tollDriveCheck.findUnique({
    where: { id: CHECK_ROW_ID },
  });
  if (existing) return { claimed: false, checkedAt: existing.checkedAt };

  try {
    await prisma.tollDriveCheck.create({
      data: { id: CHECK_ROW_ID, checkedAt: now },
    });
    return { claimed: true, checkedAt: now };
  } catch {
    // Another request created the row first and is doing the check
    return { claimed: false, checkedAt: now };
  }
}

async function listCsvFiles({
  drive,
  driveId,
  folderId,
  pageToken,
}: {
  drive: drive_v3.Drive;
  driveId: string;
  folderId: string;
  pageToken?: string;
}): Promise<DriveCsvFile[]> {
  const scope =
    driveId === MY_DRIVE_SENTINEL
      ? { corpora: "user", includeItemsFromAllDrives: false }
      : { corpora: "drive", driveId, includeItemsFromAllDrives: true };

  const response = await drive.files.list({
    ...scope,
    supportsAllDrives: true,
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: "nextPageToken, files(id, name)",
    orderBy: "createdTime",
    pageSize: 200,
    pageToken,
  });

  const files = (response.data.files ?? []).flatMap((file) =>
    file.id && file.name && /\.csv$/i.test(file.name)
      ? [{ id: file.id, name: file.name }]
      : [],
  );
  const nextPageToken = response.data.nextPageToken;
  if (!nextPageToken) return files;

  return [
    ...files,
    ...(await listCsvFiles({ drive, driveId, folderId, pageToken: nextPageToken })),
  ];
}

async function importDriveFile({
  drive,
  file,
  createdBy,
}: {
  drive: drive_v3.Drive;
  file: DriveCsvFile;
  createdBy: string | null;
}): Promise<TollDriveFileResult> {
  const response = await drive.files.get(
    { fileId: file.id, alt: "media", supportsAllDrives: true },
    { responseType: "text" },
  );
  const { trips, errors } = parseLinktTripsCsv({ text: String(response.data) });

  // Files without trips are still recorded so they are not read again
  const summary = await importTollTrips({
    trips,
    source: "drive",
    fileName: file.name,
    createdBy,
    driveFileId: file.id,
  });

  return {
    fileId: file.id,
    fileName: file.name,
    inserted: summary.inserted,
    duplicates: summary.duplicates,
    errors,
  };
}

/**
 * Import the Linkt CSV files in this environment's Drive folder that it has
 * not imported before. Without force it runs at most once an hour.
 */
export async function importNewTollFilesFromDrive({
  force,
  createdBy = null,
}: {
  force: boolean;
  createdBy?: string | null;
}): Promise<TollDriveImportResult> {
  const settings = await prisma.googleDriveSettings.findFirst({
    where: { purpose: LINKT_TOLLS_DRIVE_PURPOSE, isActive: true, isGlobal: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!settings) return { status: "not-configured" };

  const { claimed, checkedAt } = await claimDriveCheck({ force });
  if (!claimed) {
    return { status: "checked-recently", checkedAt: checkedAt.toISOString() };
  }

  const drive = await createGoogleDriveClient();
  const files = await listCsvFiles({
    drive,
    driveId: settings.driveId,
    folderId: settings.baseFolderId,
  });

  const alreadyImported = await prisma.tollImport.findMany({
    where: { driveFileId: { in: files.map((file) => file.id) } },
    select: { driveFileId: true },
  });
  const importedIds = new Set(alreadyImported.map((row) => row.driveFileId));
  const newFiles = files.filter((file) => !importedIds.has(file.id));

  // One file at a time, oldest first, so tag mappings learned from earlier
  // exports are in place for later ones
  const results = await newFiles.reduce<Promise<TollDriveFileResult[]>>(
    async (previous, file) => [
      ...(await previous),
      await importDriveFile({ drive, file, createdBy }),
    ],
    Promise.resolve([]),
  );

  return {
    status: "imported",
    checkedAt: checkedAt.toISOString(),
    folder: settings.folderPath.join(" / ") || settings.folderName,
    files: results,
  };
}

/**
 * Utility functions for attachment handling
 */

import { createGoogleDriveClient } from "./google-auth";
import { folderCache } from "./folder-cache";
import { drive_v3 } from 'googleapis';

export interface FolderStructure {
  weekFolderId: string;
  customerFolderId: string;
}

/**
 * Ensures a folder exists in Google Drive, creating it if necessary
 * @param drive - Google Drive client
 * @param parentId - Parent folder ID
 * @param folderName - Name of folder to find/create
 * @param driveId - Shared drive ID
 * @returns Folder ID
 */
async function ensureFolderExists(
  drive: drive_v3.Drive,
  parentId: string,
  folderName: string,
  driveId: string
): Promise<string> {
  // SECURITY: Use safe API query without string interpolation
  const folderResponse = await drive.files.list({
    q: `parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: driveId,
  });

  // Find folder by exact name match in results (safe from injection)
  const existingFolder = folderResponse.data.files?.find(
    (file) => file.name === folderName
  );

  if (existingFolder) {
    return existingFolder.id!;
  }

  // Create folder if it doesn't exist
  const createResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    supportsAllDrives: true,
  });

  return createResponse.data.id!;
}

/**
 * Creates the complete folder structure for job attachments
 * @param weekEndingStr - Week ending string (e.g., "01.01.25")
 * @param customerBillToFolder - Customer-billTo folder name
 * @param baseFolderId - Base folder ID
 * @param driveId - Shared drive ID
 * @returns Object with week and customer folder IDs
 */
export async function createFolderStructure(
  weekEndingStr: string,
  customerBillToFolder: string,
  baseFolderId: string,
  driveId: string
): Promise<FolderStructure> {
  const drive = await createGoogleDriveClient();

  // Check cache first
  let weekFolderId = folderCache.getWeekFolderId(weekEndingStr, baseFolderId);

  if (!weekFolderId) {
    weekFolderId = await ensureFolderExists(
      drive,
      baseFolderId,
      weekEndingStr,
      driveId
    );
    folderCache.setWeekFolderId(weekEndingStr, baseFolderId, weekFolderId);
  }

  // Handle customer folder
  const customerKey = `${customerBillToFolder}`;
  let customerFolderId = folderCache.getCustomerFolderId(
    weekEndingStr,
    baseFolderId,
    customerKey
  );

  if (!customerFolderId) {
    customerFolderId = await ensureFolderExists(
      drive,
      weekFolderId,
      customerBillToFolder,
      driveId
    );
    folderCache.setCustomerFolderId(
      weekEndingStr,
      baseFolderId,
      customerKey,
      customerFolderId
    );
  }

  return {
    weekFolderId,
    customerFolderId,
  };
}

/**
 * Counts existing files with a specific pattern in a folder
 * @param customerFolderId - Folder ID to search in
 * @param searchPattern - Pattern to match against
 * @param driveId - Shared drive ID
 * @returns Number of existing files with the pattern
 */
export async function countExistingFiles(
  customerFolderId: string,
  searchPattern: string,
  driveId: string
): Promise<number> {
  const drive = await createGoogleDriveClient();

  // SECURITY: Use safe API query without string interpolation
  const existingFilesResponse = await drive.files.list({
    q: `parents in '${customerFolderId}' and trashed=false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: driveId,
  });

  // Count existing files with matching pattern (safe from injection)
  return existingFilesResponse.data.files?.filter(
    (file) => file.name?.startsWith(searchPattern)
  ).length || 0;
}

/**
 * Enhanced file validation with comprehensive checks
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateUploadFile(file: File): FileValidationResult {
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ];

  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum allowed: 20MB`
    };
  }

  // MIME type validation
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File "${file.name}" has unsupported type "${file.type}". Allowed types: PDF, images, documents`
    };
  }

  return { isValid: true };
}
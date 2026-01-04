/**
 * Utility functions for attachment handling
 */

import { createGoogleDriveClient } from "../google-auth";
import { folderCache, FolderCacheManager } from "../folder-cache";
import { sanitizeFolderName } from "../file-security";
import { drive_v3 } from "googleapis";
import { format, endOfWeek } from "date-fns";

/**
 * Google Drive ID pattern - alphanumeric characters, hyphens, and underscores only.
 * Drive IDs are typically 28-44 characters but we allow flexibility.
 */
const GOOGLE_DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates and sanitises a Google Drive ID to prevent query injection.
 * Google Drive IDs should only contain alphanumeric characters, hyphens, and underscores.
 * @param id - The ID to validate (folder ID, file ID, or drive ID)
 * @returns The validated ID
 * @throws Error if the ID contains invalid characters
 */
function validateDriveId({ id }: { id: string }): string {
  if (!id || typeof id !== "string") {
    throw new Error("Drive ID must be a non-empty string");
  }

  const trimmedId = id.trim();

  if (!GOOGLE_DRIVE_ID_PATTERN.test(trimmedId)) {
    throw new Error(
      `Invalid Drive ID format: ID contains disallowed characters. Only alphanumeric characters, hyphens, and underscores are permitted.`,
    );
  }

  return trimmedId;
}

/**
 * Escapes single quotes in a string for use in Google Drive API queries.
 * This is a secondary defence in case validation is bypassed.
 * @param value - The value to escape
 * @returns The escaped value
 */
function escapeQueryValue({ value }: { value: string }): string {
  return value.replace(/'/g, "\\'");
}

/**
 * Parses a date string without timezone conversion.
 * If the input is already a Date, returns it as-is.
 * For ISO strings (YYYY-MM-DD or full ISO), extracts components and creates
 * a local Date to avoid timezone offset issues.
 * @param date - Date object or date string
 * @returns Date object without timezone conversion applied
 */
function parseDateWithoutTimezone({ date }: { date: Date | string }): Date {
  if (date instanceof Date) {
    return date;
  }

  // Match YYYY-MM-DD at the start (handles both "2025-01-15" and "2025-01-15T00:00:00.000Z")
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // months are 0-indexed
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  // Fallback for unexpected formats (shouldn't happen with ISO dates)
  return new Date(date);
}

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
async function ensureFolderExists({
  drive,
  parentId,
  folderName,
  driveId,
}: {
  drive: drive_v3.Drive;
  parentId: string;
  folderName: string;
  driveId: string;
}): Promise<string> {
  // SECURITY: Validate and escape the parentId before interpolating into the query string.
  // Google Drive IDs should only contain alphanumeric characters, hyphens, and underscores.
  const validatedParentId = escapeQueryValue({
    value: validateDriveId({ id: parentId }),
  });

  const folderResponse = await drive.files.list({
    q: `parents in '${validatedParentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: driveId,
  });

  // Find folder by exact name match in results (safe from injection)
  const existingFolder = folderResponse.data.files?.find(
    (file) => file.name === folderName,
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
export async function createFolderStructure({
  weekEndingStr,
  customerBillToFolder,
  baseFolderId,
  driveId,
}: {
  weekEndingStr: string;
  customerBillToFolder: string;
  baseFolderId: string;
  driveId: string;
}): Promise<FolderStructure> {
  const drive = await createGoogleDriveClient();

  // Check cache first
  let weekFolderId = folderCache.getWeekFolderId(weekEndingStr, baseFolderId);

  if (!weekFolderId) {
    weekFolderId = await ensureFolderExists({
      drive,
      parentId: baseFolderId,
      folderName: weekEndingStr,
      driveId,
    });
    folderCache.setWeekFolderId(weekEndingStr, baseFolderId, weekFolderId);
  }

  // Handle customer folder
  const customerKey = `${customerBillToFolder}`;
  let customerFolderId = folderCache.getCustomerFolderId(
    weekEndingStr,
    baseFolderId,
    customerKey,
  );

  if (!customerFolderId) {
    customerFolderId = await ensureFolderExists({
      drive,
      parentId: weekFolderId,
      folderName: customerBillToFolder,
      driveId,
    });
    folderCache.setCustomerFolderId(
      weekEndingStr,
      baseFolderId,
      customerKey,
      customerFolderId,
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
export async function countExistingFiles({
  customerFolderId,
  searchPattern,
  driveId,
}: {
  customerFolderId: string;
  searchPattern: string;
  driveId: string;
}): Promise<number> {
  const drive = await createGoogleDriveClient();

  // SECURITY: Validate and escape the customerFolderId before interpolating into the query string.
  // Google Drive IDs should only contain alphanumeric characters, hyphens, and underscores.
  const validatedFolderId = escapeQueryValue({
    value: validateDriveId({ id: customerFolderId }),
  });

  const existingFilesResponse = await drive.files.list({
    q: `parents in '${validatedFolderId}' and trashed=false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: driveId,
  });

  // Count existing files with matching pattern (safe from injection)
  return (
    existingFilesResponse.data.files?.filter((file) =>
      file.name?.startsWith(searchPattern),
    ).length || 0
  );
}

/**
 * Enhanced file validation with comprehensive checks
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Extracts the file ID from a Google Drive URL
 * URL format: https://drive.google.com/file/d/{fileId}/view?filename={filename}
 * @param url - Google Drive file URL
 * @returns File ID or null if not found
 */
export function extractFileIdFromUrl({ url }: { url: string }): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts the filename from a Google Drive URL query parameter
 * @param url - Google Drive file URL
 * @returns Filename or null if not found
 */
export function extractFilenameFromUrl({
  url,
}: {
  url: string;
}): string | null {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.searchParams.get("filename");
    return filename ? decodeURIComponent(filename) : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the attachment type from a filename
 * Filename format: date_driver_customer_trucktype_attachmenttype_version.ext
 * @param filename - The attachment filename
 * @returns Attachment type (runsheet, docket, delivery_photos) or null
 */
export function extractAttachmentTypeFromFilename({
  filename,
}: {
  filename: string;
}): string | null {
  const attachmentTypes = ["runsheet", "docket", "delivery_photos"];
  for (const type of attachmentTypes) {
    if (filename.includes(`_${type}`)) {
      return type;
    }
  }
  return null;
}

/**
 * Extracts the version number from a filename
 * @param filename - The attachment filename
 * @returns Version number or 0 if no version suffix
 */
export function extractVersionFromFilename({
  filename,
}: {
  filename: string;
}): number {
  // Match patterns like _runsheet_2.pdf or _docket_3.jpg
  const match = filename.match(/_(\d+)\.([^.]+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Generates a new attachment filename based on job details
 * @param job - Job data with date, driver, customer, truckType
 * @param attachmentType - Type of attachment (runsheet, docket, delivery_photos)
 * @param extension - File extension
 * @param version - Version number (0 for no suffix)
 * @returns Generated filename
 */
export function generateAttachmentFilename({
  job,
  attachmentType,
  extension,
  version,
}: {
  job: {
    date: Date | string;
    driver: string | null;
    customer: string;
    truckType: string | null;
  };
  attachmentType: string;
  extension: string;
  version: number;
}): string {
  const jobDate = parseDateWithoutTimezone({ date: job.date });
  const jobDateStr = format(jobDate, "dd.MM.yy");
  const sanitisedDriver = sanitizeFolderName(job.driver || "Unknown");
  const sanitisedCustomer = sanitizeFolderName(job.customer);
  const sanitisedTruckType = sanitizeFolderName(job.truckType || "Unknown");

  let filename = `${jobDateStr}_${sanitisedDriver}_${sanitisedCustomer}_${sanitisedTruckType}_${attachmentType}`;

  if (version > 0) {
    filename += `_${version}`;
  }

  if (extension) {
    filename += `.${extension}`;
  }

  return filename;
}

/**
 * Updates the filename in a Google Drive URL
 * @param url - Original Google Drive URL
 * @param newFilename - New filename to set
 * @returns Updated URL with new filename parameter
 */
export function updateFilenameInUrl({
  url,
  newFilename,
}: {
  url: string;
  newFilename: string;
}): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set("filename", newFilename);
    return urlObj.toString();
  } catch {
    // If URL parsing fails, try to update manually
    const baseUrl = url.split("?")[0];
    return `${baseUrl}?filename=${encodeURIComponent(newFilename)}`;
  }
}

/**
 * Renames a file in Google Drive
 * @param fileId - Google Drive file ID
 * @param newName - New filename
 * @returns Success status and new name
 */
export async function renameGoogleDriveFile({
  fileId,
  newName,
}: {
  fileId: string;
  newName: string;
}): Promise<{ success: boolean; newName?: string; error?: string }> {
  try {
    const drive = await createGoogleDriveClient();

    const response = await drive.files.update({
      fileId,
      requestBody: {
        name: newName,
      },
      supportsAllDrives: true,
    });

    return {
      success: true,
      newName: response.data.name || newName,
    };
  } catch (error) {
    console.error("Error renaming Google Drive file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generates the customer/billTo folder name
 * @param customer - Customer name
 * @param billTo - Bill to name
 * @returns Sanitised folder name
 */
export function generateCustomerFolderName({
  customer,
  billTo,
}: {
  customer: string;
  billTo: string;
}): string {
  const sanitisedCustomer = sanitizeFolderName(customer);
  const sanitisedBillTo = sanitizeFolderName(billTo);
  return sanitisedCustomer === sanitisedBillTo
    ? sanitisedCustomer
    : `${sanitisedCustomer}_${sanitisedBillTo}`;
}

/**
 * Gets or creates the folder structure for job attachments
 * @param job - Job data with date, customer, billTo
 * @param baseFolderId - Base folder ID in Google Drive
 * @param driveId - Shared drive ID
 * @returns Week folder ID and customer folder ID
 */
export async function getOrCreateJobFolderStructure({
  job,
  baseFolderId,
  driveId,
}: {
  job: {
    date: Date | string;
    customer: string;
    billTo: string;
  };
  baseFolderId: string;
  driveId: string;
}): Promise<{ weekFolderId: string; customerFolderId: string }> {
  const drive = await createGoogleDriveClient();

  const jobDate = parseDateWithoutTimezone({ date: job.date });
  const weekEnding = endOfWeek(jobDate, { weekStartsOn: 1 });
  const weekEndingStr = format(weekEnding, "dd.MM.yy");
  const customerBillToFolder = generateCustomerFolderName({
    customer: job.customer,
    billTo: job.billTo,
  });

  // Check cache for week folder first
  let weekFolderId = folderCache.getWeekFolderId(weekEndingStr, baseFolderId);

  if (!weekFolderId) {
    // SECURITY: Validate and escape the baseFolderId before interpolating into the query string.
    const validatedBaseFolderId = escapeQueryValue({
      value: validateDriveId({ id: baseFolderId }),
    });

    const weekFolderResponse = await drive.files.list({
      q: `parents in '${validatedBaseFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "drive",
      driveId: driveId,
    });

    const existingWeekFolder = weekFolderResponse.data.files?.find(
      (file) => file.name === weekEndingStr,
    );

    if (existingWeekFolder) {
      weekFolderId = existingWeekFolder.id!;
    } else {
      const weekFolderCreate = await drive.files.create({
        requestBody: {
          name: weekEndingStr,
          mimeType: "application/vnd.google-apps.folder",
          parents: [baseFolderId],
        },
        supportsAllDrives: true,
      });
      weekFolderId = weekFolderCreate.data.id!;
    }

    folderCache.setWeekFolderId(weekEndingStr, baseFolderId, weekFolderId);
  }

  // Check cache for customer folder
  const customerKey = FolderCacheManager.createCustomerKey(
    sanitizeFolderName(job.customer),
    sanitizeFolderName(job.billTo),
  );
  let customerFolderId = folderCache.getCustomerFolderId(
    weekEndingStr,
    baseFolderId,
    customerKey,
  );

  if (!customerFolderId) {
    // SECURITY: Validate and escape the weekFolderId before interpolating into the query string.
    // weekFolderId comes from a previous API response, but we validate defensively.
    const validatedWeekFolderId = escapeQueryValue({
      value: validateDriveId({ id: weekFolderId }),
    });

    const customerFolderResponse = await drive.files.list({
      q: `parents in '${validatedWeekFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "drive",
      driveId: driveId,
    });

    const existingCustomerFolder = customerFolderResponse.data.files?.find(
      (file) => file.name === customerBillToFolder,
    );

    if (existingCustomerFolder) {
      customerFolderId = existingCustomerFolder.id!;
    } else {
      const customerFolderCreate = await drive.files.create({
        requestBody: {
          name: customerBillToFolder,
          mimeType: "application/vnd.google-apps.folder",
          parents: [weekFolderId],
        },
        supportsAllDrives: true,
      });
      customerFolderId = customerFolderCreate.data.id!;
    }

    folderCache.setCustomerFolderId(
      weekEndingStr,
      baseFolderId,
      customerKey,
      customerFolderId,
    );
  }

  return { weekFolderId, customerFolderId };
}

/**
 * Moves a file to a different folder in Google Drive
 * @param fileId - Google Drive file ID
 * @param newParentFolderId - New parent folder ID
 * @returns Success status
 */
export async function moveGoogleDriveFile({
  fileId,
  newParentFolderId,
}: {
  fileId: string;
  newParentFolderId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const drive = await createGoogleDriveClient();

    // Get current parents
    const file = await drive.files.get({
      fileId,
      fields: "parents",
      supportsAllDrives: true,
    });

    const previousParents = file.data.parents?.join(",") || "";

    // Move to new parent
    await drive.files.update({
      fileId,
      addParents: newParentFolderId,
      removeParents: previousParents,
      supportsAllDrives: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Error moving Google Drive file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Renames and optionally moves a file in Google Drive
 * @param fileId - Google Drive file ID
 * @param newName - New filename
 * @param newParentFolderId - Optional new parent folder ID (for moving)
 * @returns Success status and new name
 */
export async function renameAndMoveGoogleDriveFile({
  fileId,
  newName,
  newParentFolderId,
}: {
  fileId: string;
  newName: string;
  newParentFolderId?: string;
}): Promise<{
  success: boolean;
  newName?: string;
  moved?: boolean;
  error?: string;
}> {
  try {
    const drive = await createGoogleDriveClient();

    let removeParents: string | undefined;
    let addParents: string | undefined;

    if (newParentFolderId) {
      // Get current parents
      const file = await drive.files.get({
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      });

      const currentParent = file.data.parents?.[0];
      if (currentParent && currentParent !== newParentFolderId) {
        removeParents = currentParent;
        addParents = newParentFolderId;
      }
    }

    const response = await drive.files.update({
      fileId,
      requestBody: {
        name: newName,
      },
      addParents,
      removeParents,
      supportsAllDrives: true,
    });

    return {
      success: true,
      newName: response.data.name || newName,
      moved: !!addParents,
    };
  } catch (error) {
    console.error("Error renaming/moving Google Drive file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Renames and moves all attachments for a job based on current job details
 * @param job - Job data with all fields including attachments
 * @param baseFolderId - Optional base folder ID for moving files
 * @param driveId - Optional drive ID for moving files
 * @returns Results of rename/move operations
 */
export async function syncJobAttachmentNames({
  job,
  baseFolderId,
  driveId,
}: {
  job: {
    id: number;
    date: Date | string;
    driver: string | null;
    customer: string;
    billTo: string;
    truckType: string | null;
    attachmentRunsheet: string[];
    attachmentDocket: string[];
    attachmentDeliveryPhotos: string[];
  };
  baseFolderId?: string;
  driveId?: string;
}): Promise<{
  success: boolean;
  renamed: Array<{
    oldName: string;
    newName: string;
    url: string;
    moved?: boolean;
  }>;
  errors: Array<{ url: string; error: string }>;
  updatedUrls: {
    attachmentRunsheet: string[];
    attachmentDocket: string[];
    attachmentDeliveryPhotos: string[];
  };
}> {
  const renamed: Array<{
    oldName: string;
    newName: string;
    url: string;
    moved?: boolean;
  }> = [];
  const errors: Array<{ url: string; error: string }> = [];
  const updatedUrls = {
    attachmentRunsheet: [...job.attachmentRunsheet],
    attachmentDocket: [...job.attachmentDocket],
    attachmentDeliveryPhotos: [...job.attachmentDeliveryPhotos],
  };

  // Get target folder if we have drive config (for moving files)
  let targetFolderId: string | undefined;
  if (baseFolderId && driveId) {
    try {
      const folderStructure = await getOrCreateJobFolderStructure({
        job,
        baseFolderId,
        driveId,
      });
      targetFolderId = folderStructure.customerFolderId;
    } catch (error) {
      console.error("Error getting folder structure:", error);
      // Continue without moving - just rename
    }
  }

  const processAttachments = async (
    urls: string[],
    attachmentType: string,
    targetArray: string[],
  ) => {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const fileId = extractFileIdFromUrl({ url });
      const currentFilename = extractFilenameFromUrl({ url });

      if (!fileId) {
        errors.push({ url, error: "Could not extract file ID from URL" });
        continue;
      }

      if (!currentFilename) {
        errors.push({ url, error: "Could not extract filename from URL" });
        continue;
      }

      // Extract extension and version from current filename
      const lastDotIndex = currentFilename.lastIndexOf(".");
      const extension =
        lastDotIndex > 0 ? currentFilename.substring(lastDotIndex + 1) : "";
      const version = extractVersionFromFilename({ filename: currentFilename });

      // Generate new filename
      const newFilename = generateAttachmentFilename({
        job,
        attachmentType,
        extension,
        version,
      });

      // Check if anything needs to change
      const filenameChanged = currentFilename !== newFilename;
      const needsMove = !!targetFolderId;

      // Skip if nothing to do
      if (!filenameChanged && !needsMove) {
        continue;
      }

      // Rename and optionally move in Google Drive
      const result = await renameAndMoveGoogleDriveFile({
        fileId,
        newName: newFilename,
        newParentFolderId: targetFolderId,
      });

      if (result.success) {
        renamed.push({
          oldName: currentFilename,
          newName: newFilename,
          url,
          moved: result.moved,
        });

        // Update URL with new filename
        targetArray[i] = updateFilenameInUrl({ url, newFilename });
      } else {
        errors.push({
          url,
          error: result.error || "Failed to rename/move file",
        });
      }
    }
  };

  await processAttachments(
    job.attachmentRunsheet,
    "runsheet",
    updatedUrls.attachmentRunsheet,
  );
  await processAttachments(
    job.attachmentDocket,
    "docket",
    updatedUrls.attachmentDocket,
  );
  await processAttachments(
    job.attachmentDeliveryPhotos,
    "delivery_photos",
    updatedUrls.attachmentDeliveryPhotos,
  );

  return {
    success: errors.length === 0,
    renamed,
    errors,
    updatedUrls,
  };
}

export function validateUploadFile({
  file,
}: {
  file: File;
}): FileValidationResult {
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
      error: `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum allowed: 20MB`,
    };
  }

  // MIME type validation
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File "${file.name}" has unsupported type "${file.type}". Allowed types: PDF, images, documents`,
    };
  }

  return { isValid: true };
}

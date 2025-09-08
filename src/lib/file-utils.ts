/**
 * Utility functions for file operations
 */

/**
 * Extract Google Drive file ID from a Google Drive URL
 */
export const extractFileIdFromUrl = (url: string): string | null => {
  try {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)\/view/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error extracting file ID from URL:', error);
    return null;
  }
};

/**
 * Extract filename from URL search parameters
 */
export const extractFilenameFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.searchParams.get('filename');
    return filename ? decodeURIComponent(filename) : null;
  } catch (error) {
    console.error('Error extracting filename from URL:', error);
    return null;
  }
};
/**
 * React Query hooks for file metadata management
 */

import { useQuery } from '@tanstack/react-query';

export interface FileMetadata {
  fileId: string;
  fileName: string | null;
  fileSize: string | null;
  mimeType: string | null;
  createdTime: string | null;
  error?: string;
}

export interface BatchMetadataResponse {
  success: boolean;
  results: FileMetadata[];
  errors?: FileMetadata[];
  totalRequested: number;
  totalSuccessful: number;
  totalFailed: number;
}

/**
 * Extract file ID from Google Drive URL
 */
export function extractFileIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)\/view/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract filename from Google Drive URL query parameters
 */
export function extractFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.searchParams.get('filename');
    return filename ? decodeURIComponent(filename) : null;
  } catch {
    return null;
  }
}

/**
 * Hook to fetch metadata for a single file
 */
export function useFileMetadata(fileId: string | null, options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return useQuery({
    queryKey: ['file-metadata', fileId],
    queryFn: async (): Promise<FileMetadata> => {
      if (!fileId) {
        throw new Error('File ID is required');
      }

      const response = await fetch(`/api/google-drive/get-metadata?fileId=${fileId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch file metadata');
      }

      return {
        fileId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        createdTime: result.createdTime,
      };
    },
    enabled: Boolean(fileId) && (options?.enabled !== false),
    staleTime: options?.staleTime,
  });
}

/**
 * Hook to fetch metadata for multiple files in a batch
 */
export function useBatchFileMetadata(fileIds: string[], options?: {
  enabled?: boolean;
  staleTime?: number;
  batchSize?: number;
}) {
  const batchSize = options?.batchSize || 50;
  
  return useQuery({
    queryKey: ['batch-file-metadata', fileIds.sort()], // Sort for consistent cache keys
    queryFn: async (): Promise<Record<string, FileMetadata>> => {
      if (fileIds.length === 0) {
        return {};
      }

      // Split into chunks if needed
      const results: Record<string, FileMetadata> = {};
      
      for (let i = 0; i < fileIds.length; i += batchSize) {
        const batch = fileIds.slice(i, i + batchSize);
        
        const response = await fetch('/api/google-drive/batch-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileIds: batch }),
        });

        const batchResult: BatchMetadataResponse = await response.json();

        if (!response.ok) {
          throw new Error('Failed to fetch batch metadata');
        }

        // Process successful results
        batchResult.results.forEach(result => {
          results[result.fileId] = result;
        });

        // Process errors
        if (batchResult.errors) {
          batchResult.errors.forEach(error => {
            results[error.fileId] = error;
          });
        }
      }

      return results;
    },
    enabled: fileIds.length > 0 && (options?.enabled !== false),
    staleTime: options?.staleTime,
  });
}

/**
 * Hook to fetch metadata for files from Google Drive URLs
 */
export function useAttachmentMetadata(urls: string[], options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  // Extract file IDs from URLs
  const fileIds = urls
    .map(extractFileIdFromUrl)
    .filter((id): id is string => id !== null);

  // Get filenames already available in URLs
  const urlFilenames = urls.reduce((acc, url) => {
    const fileId = extractFileIdFromUrl(url);
    const filename = extractFilenameFromUrl(url);
    if (fileId && filename) {
      acc[fileId] = filename;
    }
    return acc;
  }, {} as Record<string, string>);

  // Only fetch metadata for files that don't have filenames in URLs
  const fileIdsToFetch = fileIds.filter(id => !urlFilenames[id]);

  const batchQuery = useBatchFileMetadata(fileIdsToFetch, {
    enabled: options?.enabled,
    staleTime: options?.staleTime,
  });

  // Combine URL filenames with fetched metadata
  const combinedData = fileIds.reduce((acc, fileId) => {
    if (urlFilenames[fileId]) {
      // Use filename from URL
      acc[fileId] = {
        fileId,
        fileName: urlFilenames[fileId],
        fileSize: null,
        mimeType: null,
        createdTime: null,
      };
    } else if (batchQuery.data?.[fileId]) {
      // Use fetched metadata
      acc[fileId] = batchQuery.data[fileId];
    } else {
      // Fallback for loading state
      acc[fileId] = {
        fileId,
        fileName: null,
        fileSize: null,
        mimeType: null,
        createdTime: null,
      };
    }
    return acc;
  }, {} as Record<string, FileMetadata>);

  return {
    ...batchQuery,
    data: combinedData,
    isLoading: batchQuery.isLoading && fileIdsToFetch.length > 0,
    error: batchQuery.error,
  };
}

/**
 * Hook to get individual file metadata with intelligent caching
 * This is useful when you need metadata for individual files and want to
 * benefit from batch caching when multiple files are requested
 */
export function useSmartFileMetadata(fileId: string | null, options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return useQuery({
    queryKey: ['smart-file-metadata', fileId],
    queryFn: async (): Promise<FileMetadata> => {
      if (!fileId) {
        throw new Error('File ID is required');
      }

      // Try batch endpoint first (which might be cached)
      try {
        const response = await fetch('/api/google-drive/batch-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileIds: [fileId] }),
        });

        const result: BatchMetadataResponse = await response.json();

        if (response.ok && result.results.length > 0) {
          return result.results[0];
        }
      } catch {
        // Fallback to individual endpoint
      }

      // Fallback to individual metadata endpoint
      const response = await fetch(`/api/google-drive/get-metadata?fileId=${fileId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch file metadata');
      }

      return {
        fileId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        createdTime: result.createdTime,
      };
    },
    enabled: Boolean(fileId) && (options?.enabled !== false),
    staleTime: options?.staleTime,
  });
}
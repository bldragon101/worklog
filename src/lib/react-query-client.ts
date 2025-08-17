/**
 * React Query configuration and client setup
 */

import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache for 24 hours for file metadata (filenames rarely change)
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        gcTime: 24 * 60 * 60 * 1000, // 24 hours (was cacheTime in v4)
        
        // Retry configuration
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors like authentication)
          if (error instanceof Error && 'status' in error) {
            const status = (error as Error & { status?: number }).status;
            if (status && status >= 400 && status < 500) {
              return false;
            }
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        
        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch on window focus for critical data
        refetchOnWindowFocus: false,
        
        // Don't refetch on mount if data is still fresh
        refetchOnMount: false,
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
};

// Create a single instance for the app
export const queryClient = createQueryClient();
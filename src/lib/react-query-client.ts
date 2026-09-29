/**
 * React Query configuration and client setup
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Create a QueryClient with the app's defaults.
 *
 * Queries are treated as stale immediately so that each page mount refetches
 * its data (matching the behaviour of the previous fetch-on-mount effects),
 * while still showing cached data instantly when navigating back to a page.
 * Queries that can tolerate older data set their own staleTime.
 */
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,

        // Loaders report their own failures (e.g. with a toast), so a failed
        // request surfaces immediately rather than after silent retries
        retry: false,

        refetchOnWindowFocus: false,
        refetchOnMount: true,
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

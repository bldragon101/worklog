import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * A QueryClient for tests: no retries and no caching between tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Build a wrapper component that provides the given QueryClient, for use with
 * `render(..., { wrapper })` or `renderHook(..., { wrapper })`.
 */
export function createQueryWrapper({
  queryClient = createTestQueryClient(),
}: { queryClient?: QueryClient } = {}) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return QueryWrapper;
}

/**
 * Render a component inside a fresh QueryClientProvider.
 */
export function renderWithQueryClient({
  ui,
  queryClient = createTestQueryClient(),
  options,
}: {
  ui: ReactElement;
  queryClient?: QueryClient;
  options?: Omit<RenderOptions, "wrapper">;
}) {
  const result = render(ui, {
    wrapper: createQueryWrapper({ queryClient }),
    ...options,
  });
  return { ...result, queryClient };
}

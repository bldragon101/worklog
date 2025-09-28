import { useQuery } from "@tanstack/react-query";
import type { Release } from "@/lib/changelog";

interface ChangelogData {
  releases: Release[];
  currentVersion: string;
}

async function fetchChangelog(): Promise<ChangelogData> {
  const response = await fetch("/api/changelog");
  if (!response.ok) {
    throw new Error("Failed to fetch changelog");
  }
  return response.json();
}

export function useChangelog() {
  return useQuery({
    queryKey: ["changelog"],
    queryFn: fetchChangelog,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch if data exists in cache
    retry: 1,
  });
}

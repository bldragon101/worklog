import { useQuery } from "@tanstack/react-query";

export const DEFAULT_FUEL_LEVY_QUERY_KEY = ["default-fuel-levy"];

async function fetchDefaultFuelLevy(): Promise<number | null> {
  const response = await fetch("/api/admin/fuel-levy-settings");
  if (!response.ok) {
    throw new Error("Failed to fetch default fuel levy");
  }
  const data: { defaultFuelLevy: number | null } = await response.json();
  return data.defaultFuelLevy;
}

/**
 * The admin-configured default fuel levy percentage, or null when not set.
 */
export function useDefaultFuelLevy() {
  return useQuery({
    queryKey: DEFAULT_FUEL_LEVY_QUERY_KEY,
    queryFn: fetchDefaultFuelLevy,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

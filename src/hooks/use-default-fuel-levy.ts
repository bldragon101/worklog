import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export const DEFAULT_FUEL_LEVY_QUERY_KEY = queryKeys.defaultFuelLevy;

export interface FuelLevySettings {
  defaultFuelLevy: number | null;
  companySettingsConfigured: boolean;
}

async function fetchFuelLevySettings(): Promise<FuelLevySettings> {
  const response = await fetch("/api/admin/fuel-levy-settings");
  if (!response.ok) {
    throw new Error("Failed to fetch default fuel levy");
  }
  return response.json();
}

const fuelLevySettingsQuery = {
  queryKey: DEFAULT_FUEL_LEVY_QUERY_KEY,
  queryFn: fetchFuelLevySettings,
  staleTime: 5 * 60 * 1000,
  retry: 1,
};

/**
 * The fuel levy settings, including whether company settings exist so the
 * default can be saved.
 */
export function useFuelLevySettings() {
  return useQuery(fuelLevySettingsQuery);
}

/**
 * The admin-configured default fuel levy percentage, or null when not set.
 */
export function useDefaultFuelLevy() {
  return useQuery({
    ...fuelLevySettingsQuery,
    select: (settings: FuelLevySettings) => settings.defaultFuelLevy,
  });
}

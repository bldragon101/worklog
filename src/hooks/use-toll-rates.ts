import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { TollRates } from "@/lib/utils/toll-rates";

export const TOLL_RATES_QUERY_KEY = queryKeys.tollRates;

export interface TollRateSettings extends TollRates {
  companySettingsConfigured: boolean;
}

async function fetchTollRateSettings(): Promise<TollRateSettings> {
  const response = await fetch("/api/admin/toll-rate-settings");
  if (!response.ok) {
    throw new Error("Failed to fetch toll rates");
  }
  return response.json();
}

/**
 * The Eastlink and CityLink rates per crossing, including whether company
 * settings exist so the rates can be saved.
 */
export function useTollRateSettings() {
  return useQuery({
    queryKey: TOLL_RATES_QUERY_KEY,
    queryFn: fetchTollRateSettings,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

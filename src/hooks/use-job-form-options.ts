import { queryOptions, useQueries } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

interface CustomerSelectOptions {
  customerOptions?: string[];
  billToOptions?: string[];
}

interface VehicleSelectOptions {
  registrationOptions?: string[];
  truckTypeOptions?: string[];
}

interface DriverSelectOptions {
  driverOptions?: string[];
}

interface CustomerMappings {
  customerToBillTo?: Record<string, string>;
}

interface VehicleMappings {
  registrationToType?: Record<string, string>;
}

interface DriverMappings {
  driverToTruck?: Record<string, string>;
}

const EMPTY_OPTIONS: string[] = [];
const EMPTY_MAPPING: Record<string, string> = {};

export const customerSelectOptionsQuery = queryOptions({
  queryKey: queryKeys.customers.selectOptions,
  queryFn: () =>
    fetchJson<CustomerSelectOptions>({ url: "/api/customers/select-options" }),
});

export const vehicleSelectOptionsQuery = queryOptions({
  queryKey: queryKeys.vehicles.selectOptions,
  queryFn: () =>
    fetchJson<VehicleSelectOptions>({ url: "/api/vehicles/select-options" }),
});

export const driverSelectOptionsQuery = queryOptions({
  queryKey: queryKeys.drivers.selectOptions,
  queryFn: () =>
    fetchJson<DriverSelectOptions>({ url: "/api/drivers/select-options" }),
});

const customerMappingsQuery = queryOptions({
  queryKey: queryKeys.customers.mappings,
  queryFn: () => fetchJson<CustomerMappings>({ url: "/api/customers/mappings" }),
});

const vehicleMappingsQuery = queryOptions({
  queryKey: queryKeys.vehicles.mappings,
  queryFn: () => fetchJson<VehicleMappings>({ url: "/api/vehicles/mappings" }),
});

const driverMappingsQuery = queryOptions({
  queryKey: queryKeys.drivers.mappings,
  queryFn: () => fetchJson<DriverMappings>({ url: "/api/drivers/mappings" }),
});

/**
 * Custom hook for managing job form select options and auto-population mappings
 * @param isOpen - Whether the form is open (triggers data fetching)
 * @returns Select options, mappings, and loading state
 */
export function useJobFormOptions({ isOpen }: { isOpen: boolean }) {
  const [
    customerQuery,
    vehicleQuery,
    driverQuery,
    customerMappingQuery,
    vehicleMappingQuery,
    driverMappingQuery,
  ] = useQueries({
    queries: [
      { ...customerSelectOptionsQuery, enabled: isOpen },
      { ...vehicleSelectOptionsQuery, enabled: isOpen },
      { ...driverSelectOptionsQuery, enabled: isOpen },
      { ...customerMappingsQuery, enabled: isOpen },
      { ...vehicleMappingsQuery, enabled: isOpen },
      { ...driverMappingsQuery, enabled: isOpen },
    ],
  });

  const selectsLoading = [
    customerQuery,
    vehicleQuery,
    driverQuery,
    customerMappingQuery,
    vehicleMappingQuery,
    driverMappingQuery,
  ].some((query) => query.isPending || query.isFetching);

  return {
    // Options
    customerOptions: customerQuery.data?.customerOptions ?? EMPTY_OPTIONS,
    billToOptions: customerQuery.data?.billToOptions ?? EMPTY_OPTIONS,
    registrationOptions:
      vehicleQuery.data?.registrationOptions ?? EMPTY_OPTIONS,
    truckTypeOptions: vehicleQuery.data?.truckTypeOptions ?? EMPTY_OPTIONS,
    driverOptions: driverQuery.data?.driverOptions ?? EMPTY_OPTIONS,
    selectsLoading,

    // Mappings
    customerToBillTo:
      customerMappingQuery.data?.customerToBillTo ?? EMPTY_MAPPING,
    registrationToType:
      vehicleMappingQuery.data?.registrationToType ?? EMPTY_MAPPING,
    driverToTruck: driverMappingQuery.data?.driverToTruck ?? EMPTY_MAPPING,
  };
}

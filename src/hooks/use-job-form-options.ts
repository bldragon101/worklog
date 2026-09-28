import { useQueries } from "@tanstack/react-query";
import {
  customerMappingsQuery,
  customerSelectOptionsQuery,
  driverMappingsQuery,
  driverSelectOptionsQuery,
  vehicleMappingsQuery,
  vehicleSelectOptionsQuery,
} from "@/lib/queries";

const EMPTY_OPTIONS: string[] = [];
const EMPTY_MAPPING: Record<string, string> = {};

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

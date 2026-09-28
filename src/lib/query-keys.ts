/**
 * React Query key convention.
 *
 * Keys are hierarchical arrays that start with the resource name, so
 * invalidating a resource's `all` key refreshes every query beneath it
 * (e.g. `queryKeys.customers.all` also refreshes the customer select options
 * used by the job form).
 */

function entityKeys<Name extends string>({ name }: { name: Name }) {
  return {
    all: [name] as const,
    list: [name, "list"] as const,
    selectOptions: [name, "select-options"] as const,
    mappings: [name, "mappings"] as const,
  };
}

export const queryKeys = {
  changelog: ["changelog"] as const,
  defaultFuelLevy: ["default-fuel-levy"] as const,
  customers: entityKeys({ name: "customers" }),
  drivers: entityKeys({ name: "drivers" }),
  vehicles: entityKeys({ name: "vehicles" }),
};

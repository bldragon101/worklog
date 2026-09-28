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
  companySettings: ["company-settings"] as const,
  customers: entityKeys({ name: "customers" }),
  drivers: entityKeys({ name: "drivers" }),
  vehicles: entityKeys({ name: "vehicles" }),
  jobs: {
    all: ["jobs"] as const,
    list: ["jobs", "list"] as const,
  },
  rcti: {
    all: ["rcti"] as const,
    list: ({ params }: { params: string }) =>
      ["rcti", "list", params] as const,
    byDriver: ({ driverId }: { driverId: number }) =>
      ["rcti", "by-driver", driverId] as const,
    availableJobs: ({ rctiId }: { rctiId: number }) =>
      ["rcti", "available-jobs", rctiId] as const,
  },
  jobsReport: {
    all: ["jobs-report"] as const,
    list: ({ params }: { params: string }) =>
      ["jobs-report", "list", params] as const,
    byDriver: ({ driverId }: { driverId: string }) =>
      ["jobs-report", "by-driver", driverId] as const,
  },
  rctiDeductions: {
    all: ["rcti-deductions"] as const,
    forDriver: ({ driverId }: { driverId: number }) =>
      ["rcti-deductions", "driver", driverId] as const,
    pending: ({
      driverId,
      weekEnding,
    }: {
      driverId: number;
      weekEnding: string;
    }) => ["rcti-deductions", "pending", driverId, weekEnding] as const,
  },
  users: {
    all: ["users"] as const,
    list: ["users", "list"] as const,
  },
  activityLogs: {
    all: ["activity-logs"] as const,
    list: ({ params }: { params: string }) =>
      ["activity-logs", "list", params] as const,
  },
  user: {
    all: ["user"] as const,
    role: ["user", "role"] as const,
  },
  admin: {
    all: ["admin"] as const,
    quickEditSettings: ["admin", "quick-edit-settings"] as const,
    settings: ["admin", "settings"] as const,
  },
  googleDrive: {
    all: ["google-drive"] as const,
    settings: ({ purpose }: { purpose: string }) =>
      ["google-drive", "settings", purpose] as const,
  },
};

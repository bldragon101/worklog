/**
 * Joins a driver's first and optional last name for display. Jobs store only
 * the first name, so use this wherever the full name is wanted.
 */
export function formatDriverFullName({
  driver,
  lastName,
}: {
  driver: string;
  lastName?: string | null;
}): string {
  const trimmedLastName = lastName?.trim();
  return trimmedLastName ? `${driver} ${trimmedLastName}` : driver;
}

/**
 * A subcontractor's company name: the business name, or the truck field,
 * which holds the company's abbreviation.
 */
export function getSubcontractorCompanyName({
  businessName,
  truck,
}: {
  businessName?: string | null;
  truck: string;
}): string {
  return businessName?.trim() || truck;
}

/**
 * The name to show for a driver in lists: the company name for
 * subcontractors and the full name for everyone else.
 */
export function formatDriverDisplayName({
  driver,
  lastName,
  type,
  businessName,
  truck,
}: {
  driver: string;
  lastName?: string | null;
  type: string;
  businessName?: string | null;
  truck: string;
}): string {
  return type === "Subcontractor"
    ? getSubcontractorCompanyName({ businessName, truck })
    : formatDriverFullName({ driver, lastName });
}

/**
 * The person's name to show beside a subcontractor's company name, or null
 * when the driver is not a subcontractor or the first name just repeats the
 * company abbreviation in the truck field.
 */
export function formatSubcontractorDriverName({
  driver,
  lastName,
  type,
  truck,
}: {
  driver: string;
  lastName?: string | null;
  type: string;
  truck: string;
}): string | null {
  return type === "Subcontractor" && driver !== truck
    ? formatDriverFullName({ driver, lastName })
    : null;
}

/**
 * Text the drivers table searches and sorts on: the display name, followed by
 * the full name for subcontractors so either can be searched.
 */
export function formatDriverSearchName({
  driver,
  lastName,
  type,
  businessName,
  truck,
}: {
  driver: string;
  lastName?: string | null;
  type: string;
  businessName?: string | null;
  truck: string;
}): string {
  const displayName = formatDriverDisplayName({
    driver,
    lastName,
    type,
    businessName,
    truck,
  });
  return type === "Subcontractor"
    ? `${displayName} ${formatDriverFullName({ driver, lastName })}`
    : displayName;
}

/**
 * Groups subcontractors by company name, with companies and the drivers
 * within each company sorted alphabetically.
 */
export function groupDriversByCompany<
  T extends {
    driver: string;
    lastName?: string | null;
    businessName?: string | null;
    truck: string;
  },
>({ drivers }: { drivers: T[] }): { label: string; drivers: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const driver of drivers) {
    const label = getSubcontractorCompanyName(driver);
    const group = groups.get(label);
    if (group) {
      group.push(driver);
    } else {
      groups.set(label, [driver]);
    }
  }
  return Array.from(groups, ([label, groupDrivers]) => ({
    label,
    drivers: groupDrivers.toSorted((a, b) =>
      formatDriverFullName(a).localeCompare(formatDriverFullName(b)),
    ),
  })).toSorted((a, b) => a.label.localeCompare(b.label));
}

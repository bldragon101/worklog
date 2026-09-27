import vicRegionalSuburbs from "@/lib/data/vic-regional-suburbs.json";

const regionalSuburbNames = new Set<string>(vicRegionalSuburbs);

/**
 * Whether a suburb name is a known Victorian suburb outside Greater Melbourne.
 * Custom entries and names shared by metro and regional suburbs return false.
 */
export function isRegionalSuburb({ name }: { name: string }): boolean {
  return regionalSuburbNames.has(name.trim().toLowerCase());
}

/**
 * Drop-off suburbs to flag as regional. Only flagged when no pickup suburb is
 * itself regional, so jobs that stay within a regional area are not flagged.
 */
export function getRegionalDropoffs({
  pickup,
  dropoff,
}: {
  pickup: string[];
  dropoff: string[];
}): string[] {
  if (pickup.some((name) => isRegionalSuburb({ name }))) return [];
  return dropoff.filter((name) => isRegionalSuburb({ name }));
}

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

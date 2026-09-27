export const FUEL_LEVY_MAX = 100;

/**
 * Converts a fuel levy input into a percentage rounded to two decimal places,
 * or null when empty or not a number. Range is not enforced here; use
 * isFuelLevyInRange to check the result.
 */
export function parseFuelLevy({ value }: { value: string }): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

/**
 * Whether a fuel levy percentage is within the allowed 0-100 range.
 */
export function isFuelLevyInRange({ value }: { value: number }): boolean {
  return value >= 0 && value <= FUEL_LEVY_MAX;
}

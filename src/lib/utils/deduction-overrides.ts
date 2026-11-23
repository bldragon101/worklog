/**
 * Reads `deductionOverrides` from a finalise request body into a map of
 * deduction ID to the amount to apply (null skips it this cycle). Returns an
 * error message when a value is neither a number nor null.
 */
export function parseDeductionOverrides({
  body,
}: {
  body: unknown;
}):
  | { overrides: Map<number, number | null> }
  | { error: string } {
  const raw =
    body && typeof body === "object" && "deductionOverrides" in body
      ? (body as { deductionOverrides?: unknown }).deductionOverrides
      : undefined;
  const overrides = new Map<number, number | null>();
  if (!raw || typeof raw !== "object") return { overrides };

  for (const [key, value] of Object.entries(raw)) {
    const deductionId = parseInt(key, 10);
    if (isNaN(deductionId)) {
      continue;
    }

    if (value === null || value === undefined) {
      // Explicit null/undefined means skip this deduction
      overrides.set(deductionId, null);
      continue;
    }

    // Reject non-number types before coercion (arrays, objects, booleans, empty strings)
    const valueType = typeof value;
    const numericValue = Number(value);
    if (
      valueType === "boolean" ||
      valueType === "object" ||
      (valueType === "string" && (value as string).trim() === "") ||
      !Number.isFinite(numericValue)
    ) {
      return {
        error: `Invalid deduction override value for deduction ${deductionId}: must be a number or null`,
      };
    }

    overrides.set(deductionId, numericValue);
  }

  return { overrides };
}

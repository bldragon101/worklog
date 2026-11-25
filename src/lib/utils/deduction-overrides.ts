/**
 * Reads `deductionOverrides` from a finalise request body into a map of
 * deduction ID to the amount to apply (null or undefined skips it this cycle).
 * Returns an error message when a value is neither a number of zero or more nor
 * null: booleans, objects, arrays and blank strings are rejected before numeric
 * coercion, and negative amounts are rejected because they would record a
 * negative application that unfinalising turns into a payment.
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
      overrides.set(deductionId, null);
      continue;
    }

    const valueType = typeof value;
    const numericValue = Number(value);
    if (
      valueType === "boolean" ||
      valueType === "object" ||
      (valueType === "string" && (value as string).trim() === "") ||
      !Number.isFinite(numericValue) ||
      numericValue < 0
    ) {
      return {
        error: `Invalid deduction override value for deduction ${deductionId}: must be a number of zero or more, or null`,
      };
    }

    overrides.set(deductionId, numericValue);
  }

  return { overrides };
}

/**
 * Applies per-document adjustments to the pending deductions the way
 * finalising would: a skipped item (null) is left out and an adjusted amount
 * replaces the default, capped at what is still owed.
 */
export function applyOverridesToPending<
  T extends { id: number; amountToApply: number; amountRemaining: number },
>({
  pending,
  overrides,
}: {
  pending: T[];
  overrides: Map<number, number | null>;
}): T[] {
  return pending.flatMap((item) => {
    const override = overrides.get(item.id);
    if (override === null) return [];
    if (override === undefined) return [item];
    return [
      {
        ...item,
        amountToApply: Math.min(Math.max(override, 0), item.amountRemaining),
      },
    ];
  });
}

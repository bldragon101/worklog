type DecimalLike = number | string | { toNumber: () => number };

/**
 * Format an amount as dollars with two decimals, putting the sign before the
 * dollar sign: -$70.00, not $-70.00.
 */
export function formatCurrency({ amount }: { amount: DecimalLike }): string {
  const value =
    typeof amount === "object" ? amount.toNumber() : Number(amount);
  const formatted = `$${Math.abs(value).toFixed(2)}`;
  return value < 0 && formatted !== "$0.00" ? `-${formatted}` : formatted;
}

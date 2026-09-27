export const COUNTRY_RUN_UNITS = ["hours", "percentage"] as const;

export type CountryRunUnit = (typeof COUNTRY_RUN_UNITS)[number];

const COUNTRY_RUN_COMMENT_PATTERN = /\*country run[^*]*\*/gi;

/**
 * Formats a country run charge, e.g. "1.5 hours", "1 hour" or "10%".
 */
export function formatCountryRunCharge({
  value,
  unit,
}: {
  value: number;
  unit: CountryRunUnit;
}): string {
  if (unit === "percentage") return `${value}%`;
  return `${value} ${value === 1 ? "hour" : "hours"}`;
}

/**
 * Builds the comment note for a country run, e.g.
 * "*country run Belmont + 1.5 hours*".
 */
export function buildCountryRunComment({
  suburbs,
  value,
  unit,
}: {
  suburbs: string[];
  value: number;
  unit: CountryRunUnit;
}): string {
  const location = suburbs.length > 0 ? ` ${suburbs.join(", ")}` : "";
  return `*country run${location} + ${formatCountryRunCharge({ value, unit })}*`;
}

/**
 * Replaces any existing country run note in the comments with one for the
 * given charge, or removes it when there is no charge. Other comment text is
 * kept as is.
 */
export function applyCountryRunComment({
  comments,
  suburbs,
  value,
  unit,
}: {
  comments: string;
  suburbs: string[];
  value: number | null;
  unit: CountryRunUnit;
}): string {
  const remaining = comments
    .split("\n")
    .flatMap((line) => {
      const stripped = line.replace(COUNTRY_RUN_COMMENT_PATTERN, "");
      if (stripped === line) return [line];
      return stripped.trim() === "" ? [] : [stripped.trimEnd()];
    })
    .join("\n")
    .trimEnd();

  if (value === null || value <= 0) return remaining;

  const note = buildCountryRunComment({ suburbs, value, unit });
  return remaining ? `${remaining}\n${note}` : note;
}

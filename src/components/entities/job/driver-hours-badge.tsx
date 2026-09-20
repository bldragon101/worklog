import {
  getDriverHoursBreakdown,
  type DriverHoursBreakdown,
} from "@/lib/utils/rcti-calculations";

type DecimalLike = number | { toNumber: () => number };

interface DriverHoursProps {
  chargedHours: DecimalLike | null;
  travelTimeHours: DecimalLike | null | undefined;
  driverCharge: DecimalLike | null | undefined;
  deductionHours?: DecimalLike | null;
}

const ADDITION_BADGE_CLASSES =
  "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
const DEDUCTION_BADGE_CLASSES =
  "rounded bg-red-100 px-1.5 py-0.5 text-[10px] leading-none text-red-700 dark:bg-red-950/50 dark:text-red-300";

/**
 * Describe how a job's driver hours differ from the hours charged, so the same
 * wording is used in table badges and tooltips.
 */
export function describeDriverHours({
  chargedHours,
  travelTimeHours,
  driverCharge,
  deductionHours,
}: DriverHoursProps): {
  breakdown: DriverHoursBreakdown;
  /** Short badge text, or null when there is nothing to flag. */
  label: string | null;
  tooltip: string;
} {
  const breakdown = getDriverHoursBreakdown({
    chargedHours,
    travelTimeHours,
    driverCharge,
    deductionHours,
  });

  const travelNote =
    breakdown.travelHours > 0
      ? ` + ${breakdown.travelHours.toFixed(2)} travel`
      : "";
  const deductionNote = breakdown.hasDeduction
    ? `, ${breakdown.deductionHours.toFixed(2)} deducted`
    : "";
  const tooltip = `Driver paid ${breakdown.totalDriverHours.toFixed(2)} hrs — ${breakdown.chargedHours.toFixed(2)} charged${travelNote}${deductionNote}`;

  // The badge sits under the charged hours cell, so it reads as the difference
  // between what the customer is charged and what the driver is paid.
  const delta = breakdown.deltaFromCharged;
  let label: string | null = null;
  if (delta > 0) {
    label = `+${delta.toFixed(2)} driver`;
  } else if (delta < 0) {
    label = `-${Math.abs(delta).toFixed(2)} driver`;
  } else if (breakdown.hasDeduction) {
    // Charged hours are paid in full but travel hours were withheld.
    label = `-${breakdown.deductionHours.toFixed(2)} deducted`;
  }

  return { breakdown, label, tooltip };
}

/**
 * Inline summary for the job form, spelling out the resolved driver hours and
 * any deduction.
 */
export function DriverHoursSummary({
  chargedHours,
  travelTimeHours,
  driverCharge,
  deductionHours,
}: DriverHoursProps) {
  const { breakdown, tooltip } = describeDriverHours({
    chargedHours,
    travelTimeHours,
    driverCharge,
    deductionHours,
  });

  return (
    <p
      className={`text-xs ${
        breakdown.hasDeduction
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground"
      }`}
    >
      {tooltip}
    </p>
  );
}

/**
 * Badge shown beside charged hours when a job's driver hours differ from the
 * hours charged. Mirrors the travel hours badge, but turns red for a deduction.
 */
export function DriverHoursBadge({
  chargedHours,
  travelTimeHours,
  driverCharge,
  deductionHours,
}: DriverHoursProps) {
  const { breakdown, label, tooltip } = describeDriverHours({
    chargedHours,
    travelTimeHours,
    driverCharge,
    deductionHours,
  });

  if (!label) return null;

  return (
    <span
      title={tooltip}
      className={
        breakdown.hasDeduction
          ? DEDUCTION_BADGE_CLASSES
          : ADDITION_BADGE_CLASSES
      }
    >
      {label}
    </span>
  );
}

import { getLineDriverHoursBreakdown } from "@/lib/utils/rcti-calculations";

const TRAVEL_BADGE_CLASSES =
  "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal leading-none text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
const DEDUCTION_BADGE_CLASSES =
  "rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-normal leading-none text-red-700 dark:bg-red-950/50 dark:text-red-300";

export interface DriverHoursCellProps {
  chargedHours: number | null;
  travelTimeHours: number | null;
  driverCharge: number | null;
}

/**
 * Shows a line's total driver hours with travel, extra driver hours and
 * deduction badges.
 */
export function DriverHoursCell({
  chargedHours,
  travelTimeHours,
  driverCharge,
}: DriverHoursCellProps) {
  const breakdown = getLineDriverHoursBreakdown({
    chargedHours,
    travelTimeHours,
    driverCharge,
  });
  const addition = Math.max(0, breakdown.adjustmentFromBase);

  return (
    <div className="flex flex-col items-end gap-1">
      <span>{breakdown.totalDriverHours.toFixed(2)}</span>
      {breakdown.travelHours > 0.001 ? (
        <span
          title={`${breakdown.travelHours.toFixed(2)} travel hours added to ${breakdown.chargedHours.toFixed(2)} job hours`}
          className={TRAVEL_BADGE_CLASSES}
        >
          +{breakdown.travelHours.toFixed(2)} travel
        </span>
      ) : null}
      {addition > 0.001 ? (
        <span
          title={`${addition.toFixed(2)} extra hours paid to the driver on top of ${breakdown.baseHours.toFixed(2)} job plus travel hours`}
          className={TRAVEL_BADGE_CLASSES}
        >
          +{addition.toFixed(2)} driver
        </span>
      ) : null}
      {breakdown.hasDeduction ? (
        <span
          title={`${breakdown.deductionHours.toFixed(2)} hours deducted from ${breakdown.baseHours.toFixed(2)} job plus travel hours`}
          className={DEDUCTION_BADGE_CLASSES}
        >
          -{breakdown.deductionHours.toFixed(2)} deduction
        </span>
      ) : null}
    </div>
  );
}

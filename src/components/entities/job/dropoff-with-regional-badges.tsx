import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/utils";
import { REGIONAL_BADGE_CLASS } from "@/components/shared/regional-badge-styles";
import { getRegionalDropoffs } from "@/lib/utils/regional-suburbs";

const splitSuburbs = ({ value }: { value: string | null | undefined }) =>
  (value ?? "")
    .split(",")
    .map((suburb) => suburb.trim())
    .filter((suburb) => suburb.length > 0);

/**
 * Lists a job's drop-off suburbs, badging those that are regional for the
 * job's pickup.
 */
export function DropoffWithRegionalBadges({
  pickup,
  dropoff,
  className,
}: {
  pickup: string | null | undefined;
  dropoff: string | null | undefined;
  className?: string;
}) {
  const dropoffSuburbs = splitSuburbs({ value: dropoff });
  const regionalDropoffs = getRegionalDropoffs({
    pickup: splitSuburbs({ value: pickup }),
    dropoff: dropoffSuburbs,
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {dropoffSuburbs.map((suburb, index) => {
        const separator = index < dropoffSuburbs.length - 1 ? "," : "";
        return regionalDropoffs.includes(suburb) ? (
          <Badge
            key={suburb}
            variant="outline"
            title={`${suburb} (regional suburb)`}
            className={cn("px-1.5 py-0 font-mono text-xs", REGIONAL_BADGE_CLASS)}
          >
            {suburb}
            <span className="sr-only"> (regional)</span>
          </Badge>
        ) : (
          <span key={suburb}>
            {suburb}
            {separator}
          </span>
        );
      })}
    </div>
  );
}

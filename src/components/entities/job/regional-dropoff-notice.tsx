import { Badge } from "@/components/ui/badge";

/**
 * Flags regional drop-off suburbs so the user can decide whether country run
 * charges apply. Renders nothing when there are none.
 */
export function RegionalDropoffNotice({ suburbs }: { suburbs: string[] }) {
  if (suburbs.length === 0) return null;

  return (
    <div
      id="regional-dropoff-notice"
      className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
    >
      {suburbs.map((suburb) => (
        <Badge
          key={suburb}
          variant="outline"
          className="border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Regional: {suburb}
        </Badge>
      ))}
      <span>Check whether country run charges apply.</span>
    </div>
  );
}

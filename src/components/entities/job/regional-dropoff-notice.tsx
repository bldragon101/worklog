import { Badge } from "@/components/ui/badge";

/**
 * Flags regional drop-off suburbs so the user can decide whether country run
 * charges apply. The live region is always rendered so screen readers
 * announce the notice when it appears.
 */
export function RegionalDropoffNotice({ suburbs }: { suburbs: string[] }) {
  return (
    <div
      id="regional-dropoff-notice"
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground empty:hidden"
    >
      {suburbs.length > 0 && (
        <>
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
        </>
      )}
    </div>
  );
}

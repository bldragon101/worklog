"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { addDaysToIsoDate, formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";

export interface InvoiceWeekSelectorProps {
  weekEnding: string;
  defaultWeekEnding: string;
  isLoading: boolean;
  onWeekEndingChange: ({ weekEnding }: { weekEnding: string }) => void;
}

/** Previous/next week buttons around the week ending (DD/MM/YYYY) */
export function InvoiceWeekSelector({
  weekEnding,
  defaultWeekEnding,
  isLoading,
  onWeekEndingChange,
}: InvoiceWeekSelectorProps) {
  const weekStart = addDaysToIsoDate({ isoDate: weekEnding, days: -6 });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        id="invoice-previous-week-btn"
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label="Previous week"
        onClick={() =>
          onWeekEndingChange({ weekEnding: addDaysToIsoDate({ isoDate: weekEnding, days: -7 }) })
        }
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true">
          <title>Previous week</title>
        </ChevronLeft>
      </Button>
      <div className="min-w-[11rem] text-center">
        <p id="invoice-week-ending-label" className="text-sm font-semibold">
          Week ending {formatDateDDMMYYYY({ isoString: weekEnding })}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDateDDMMYYYY({ isoString: weekStart })} to{" "}
          {formatDateDDMMYYYY({ isoString: weekEnding })}
        </p>
      </div>
      <Button
        id="invoice-next-week-btn"
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label="Next week"
        onClick={() =>
          onWeekEndingChange({ weekEnding: addDaysToIsoDate({ isoDate: weekEnding, days: 7 }) })
        }
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true">
          <title>Next week</title>
        </ChevronRight>
      </Button>
      {weekEnding !== defaultWeekEnding && (
        <Button
          id="invoice-latest-week-btn"
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => onWeekEndingChange({ weekEnding: defaultWeekEnding })}
        >
          Latest week
        </Button>
      )}
      <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {isLoading && (
          <span className="flex items-center gap-1.5">
            <Spinner size="sm" aria-hidden="true" />
            Loading invoices...
          </span>
        )}
      </div>
    </div>
  );
}

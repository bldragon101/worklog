"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { CopyTollsButton } from "@/components/tolls/copy-tolls-button";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { TOLL_ROAD_LABELS, type TollRoad } from "@/lib/tolls/toll-matching";
import {
  describeTollTrip,
  formatTollGroupsForCopy,
  groupTollJobsForCopy,
} from "@/lib/tolls/toll-copy";
import type { JobTollsResponse, TollJobTrip } from "@/lib/tolls/toll-types";
import type { Job } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";

const ROAD_TEXT_CLASSES: Record<TollRoad, string> = {
  citylink: "text-blue-700 dark:text-blue-300",
  eastlink: "text-purple-700 dark:text-purple-300",
};

type JobTollFields = Pick<
  Job,
  "id" | "date" | "registration" | "startTime" | "finishTime" | "citylink" | "eastlink"
>;

function describeTollCounts({
  citylink,
  eastlink,
}: {
  citylink: number;
  eastlink: number;
}): string | null {
  const parts = [
    citylink > 0 ? `${TOLL_ROAD_LABELS.citylink} ${citylink}` : null,
    eastlink > 0 ? `${TOLL_ROAD_LABELS.eastlink} ${eastlink}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function TollTripList({ trips }: { trips: TollJobTrip[] }) {
  return (
    <ul aria-label="Linkt toll trips" className="divide-y border-t text-xs">
      {trips.map((trip) => {
        const details = describeTollTrip({ tripDetails: trip.tripDetails });
        return (
          <li key={trip.id} className="flex items-baseline gap-3 py-1.5">
            <span className="w-10 shrink-0 font-mono text-muted-foreground">
              {trip.tripStart.substring(11, 16)}
            </span>
            <span className={`w-14 shrink-0 font-medium ${ROAD_TEXT_CLASSES[trip.road]}`}>
              {TOLL_ROAD_LABELS[trip.road]}
            </span>
            <span className="min-w-0 flex-1 truncate" title={details}>
              {details}
            </span>
            <span className="shrink-0 font-mono">{formatCurrency({ amount: trip.amount })}</span>
          </li>
        );
      })}
    </ul>
  );
}

function LinktTolls({
  id,
  date,
  registration,
  startTime,
  finishTime,
  citylink,
  eastlink,
}: JobTollFields) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.tolls.job({ jobId: id, registration, date, startTime, finishTime }),
    queryFn: () =>
      fetchJson<JobTollsResponse>({
        url: `/api/tolls/jobs/${id}`,
        fallbackMessage: "Failed to load job tolls",
      }),
  });

  const recorded = describeTollCounts({ citylink: citylink ?? 0, eastlink: eastlink ?? 0 });

  if (isLoading) {
    return (
      <p role="status" className="text-muted-foreground">
        Loading Linkt trips...
      </p>
    );
  }

  if (isError || !data) {
    return <p className="text-red-600">Could not load Linkt trips for this job.</p>;
  }

  const actual = describeTollCounts({
    citylink: data.actualCitylink,
    eastlink: data.actualEastlink,
  });
  const isMismatch =
    (citylink ?? 0) !== data.actualCitylink || (eastlink ?? 0) !== data.actualEastlink;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={actual ? undefined : "text-muted-foreground"}>
          {actual ?? "No Linkt trips"}
        </span>
        {data.trips.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-mono font-medium">
              {formatCurrency({ amount: data.tollCost })}
            </span>
            <CopyTollsButton
              id="copy-job-tolls-sheet-btn"
              description="Toll details copied for invoicing."
              getText={() =>
                formatTollGroupsForCopy({ groups: groupTollJobsForCopy({ jobs: [data] }) })
              }
            />
          </div>
        )}
      </div>
      {isMismatch && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Job records {recorded ?? "no tolls"}
        </p>
      )}
      {data.trips.length > 0 && <TollTripList trips={data.trips} />}
    </div>
  );
}

/**
 * The job sidebar's tolls. Users who manage tolls see the Linkt trips matched
 * to the job, with a warning when they differ from the counts recorded on it;
 * everyone else sees the recorded counts.
 */
export function JobTollsSection({
  id,
  date,
  registration,
  startTime,
  finishTime,
  citylink,
  eastlink,
}: Job) {
  const { checkPermission } = usePermissions();

  if (!checkPermission("manage_tolls")) {
    const recorded = describeTollCounts({ citylink: citylink ?? 0, eastlink: eastlink ?? 0 });
    return (
      <p className={recorded ? "text-sm" : "text-sm text-muted-foreground"}>
        {recorded ?? "None recorded"}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <LinktTolls
        id={id}
        date={date}
        registration={registration}
        startTime={startTime}
        finishTime={finishTime}
        citylink={citylink}
        eastlink={eastlink}
      />
    </div>
  );
}

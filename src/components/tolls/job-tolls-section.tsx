"use client";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/skeleton";
import { CopyTollsButton } from "@/components/tolls/copy-tolls-button";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { TOLL_ROAD_LABELS } from "@/lib/tolls/toll-matching";
import {
  describeTollTrip,
  formatTollGroupsForCopy,
  groupTollJobsForCopy,
} from "@/lib/tolls/toll-copy";
import type { JobTollsResponse } from "@/lib/tolls/toll-types";
import type { Job } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/utils";

function describeTollCounts({
  citylink,
  eastlink,
}: {
  citylink: number;
  eastlink: number;
}): string {
  const parts = [
    citylink > 0 ? `${TOLL_ROAD_LABELS.citylink} ${citylink}` : null,
    eastlink > 0 ? `${TOLL_ROAD_LABELS.eastlink} ${eastlink}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "None";
}

function LinktTrips({
  id,
  date,
  registration,
  startTime,
  finishTime,
  citylink,
  eastlink,
}: Pick<
  Job,
  "id" | "date" | "registration" | "startTime" | "finishTime" | "citylink" | "eastlink"
>) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.tolls.job({ jobId: id, registration, date, startTime, finishTime }),
    queryFn: () =>
      fetchJson<JobTollsResponse>({
        url: `/api/tolls/jobs/${id}`,
        fallbackMessage: "Failed to load job tolls",
      }),
  });

  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-2 text-muted-foreground">
        <Spinner size="sm" aria-hidden="true" />
        Loading Linkt trips...
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-red-600">Could not load Linkt trips for this job.</p>;
  }

  if (data.trips.length === 0) {
    return <p className="text-muted-foreground">No Linkt trips matched to this job.</p>;
  }

  const isMismatch =
    (citylink ?? 0) !== data.actualCitylink || (eastlink ?? 0) !== data.actualEastlink;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-muted-foreground", isMismatch && "text-red-600 font-medium")}>
          Linkt: {describeTollCounts({ citylink: data.actualCitylink, eastlink: data.actualEastlink })}
          {isMismatch && " (differs from job)"}
        </span>
        <CopyTollsButton
          id="copy-job-tolls-sheet-btn"
          label="Copy tolls"
          description="Toll details copied for invoicing."
          getText={() =>
            formatTollGroupsForCopy({ groups: groupTollJobsForCopy({ jobs: [data] }) })
          }
        />
      </div>
      <table className="w-full text-xs">
        <caption className="sr-only">Linkt toll trips for this job</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-1 pr-2 text-left font-medium">Time</th>
            <th scope="col" className="py-1 pr-2 text-left font-medium">Trip</th>
            <th scope="col" className="py-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.trips.map((trip) => (
            <tr key={trip.id} className="border-b last:border-0 align-top">
              <td className="py-1 pr-2 font-mono whitespace-nowrap">
                {trip.tripStart.substring(11, 16)}
              </td>
              <td className="py-1 pr-2">
                <span className="font-medium">{TOLL_ROAD_LABELS[trip.road]}</span>{" "}
                <span className="text-muted-foreground">
                  {describeTollTrip({ tripDetails: trip.tripDetails })}
                </span>
              </td>
              <td className="py-1 text-right font-mono">
                {formatCurrency({ amount: trip.amount })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td colSpan={2} className="py-1 pr-2">
              Total ({data.trips.length} {data.trips.length === 1 ? "trip" : "trips"})
            </td>
            <td className="py-1 text-right font-mono">
              {formatCurrency({ amount: data.tollCost })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * The job sidebar's tolls: the counts recorded on the job, and for users who
 * manage tolls, the Linkt trips matched to it with a copy button for invoicing.
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

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Recorded on job</span>
        <span className="font-mono">
          {describeTollCounts({ citylink: citylink ?? 0, eastlink: eastlink ?? 0 })}
        </span>
      </div>
      {checkPermission("manage_tolls") && (
        <LinktTrips
          id={id}
          date={date}
          registration={registration}
          startTime={startTime}
          finishTime={finishTime}
          citylink={citylink}
          eastlink={eastlink}
        />
      )}
    </div>
  );
}

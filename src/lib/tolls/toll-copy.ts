import { formatCurrency } from "@/lib/utils/currency";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import { TOLL_ROAD_LABELS, type TollRoad } from "@/lib/tolls/toll-matching";
import type { TollJobRow, TollTripRow } from "@/lib/tolls/toll-types";

export interface CopyableTollTrip {
  tripStart: string;
  tripDetails: string;
  road: TollRoad;
  amount: number;
}

/** The toll trips of one vehicle on one day, copied under a single heading */
export interface TollCopyGroup {
  /** YYYY-MM-DD */
  day: string;
  registration: string;
  driver: string | null;
  trips: CopyableTollTrip[];
}

/** Trip details without the "EL " prefix Linkt puts on EastLink trips */
export function describeTollTrip({ tripDetails }: { tripDetails: string }): string {
  return tripDetails.trim().replace(/^EL\s+/i, "");
}

/** Sum of trip amounts, added in cents to avoid floating point drift */
export function sumTollTripAmounts({ trips }: { trips: { amount: number }[] }): number {
  return trips.reduce((total, trip) => total + Math.round(trip.amount * 100), 0) / 100;
}

function describeTripCount({ count }: { count: number }): string {
  return `${count} ${count === 1 ? "trip" : "trips"}`;
}

function formatTollGroup({ group }: { group: TollCopyGroup }): string {
  const heading = [
    `Tolls ${formatDateDDMMYYYY({ isoString: group.day })}`,
    group.registration,
    group.driver,
  ]
    .filter(Boolean)
    .join(" - ");
  const lines = [...group.trips]
    .sort((a, b) => a.tripStart.localeCompare(b.tripStart))
    .map((trip) =>
      [
        trip.tripStart.substring(11, 16),
        TOLL_ROAD_LABELS[trip.road],
        describeTollTrip({ tripDetails: trip.tripDetails }),
        formatCurrency({ amount: trip.amount }),
      ].join(" "),
    );
  const total = `Total: ${formatCurrency({
    amount: sumTollTripAmounts({ trips: group.trips }),
  })} (${describeTripCount({ count: group.trips.length })})`;

  return [heading, ...lines, total].join("\n");
}

/**
 * Plain text for pasting toll charges into the invoicing system: a heading per
 * vehicle and day, one line per trip in time order, then a total. A grand
 * total follows when more than one group is copied.
 */
export function formatTollGroupsForCopy({ groups }: { groups: TollCopyGroup[] }): string {
  const groupsWithTrips = groups.filter((group) => group.trips.length > 0);
  const blocks = groupsWithTrips.map((group) => formatTollGroup({ group }));

  if (groupsWithTrips.length > 1) {
    const allTrips = groupsWithTrips.flatMap((group) => group.trips);
    blocks.push(
      `Grand total: ${formatCurrency({
        amount: sumTollTripAmounts({ trips: allTrips }),
      })} (${describeTripCount({ count: allTrips.length })})`,
    );
  }

  return blocks.join("\n\n");
}

/** Groups listed trips by day and vehicle, earliest day first */
export function groupTollTripsForCopy({ trips }: { trips: TollTripRow[] }): TollCopyGroup[] {
  const groups = new Map<string, TollCopyGroup>();

  for (const trip of trips) {
    const day = trip.tripStart.slice(0, 10);
    const registration = trip.registration ?? `Tag ${trip.tagNumber ?? "unknown"}`;
    const key = `${day}|${registration}`;
    const group = groups.get(key) ?? { day, registration, driver: null, trips: [] };
    group.driver = group.driver ?? trip.job?.driver ?? null;
    group.trips.push(trip);
    groups.set(key, group);
  }

  return [...groups.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.registration.localeCompare(b.registration),
  );
}

/** One copy group per job, earliest job first */
export function groupTollJobsForCopy({
  jobs,
}: {
  jobs: Pick<TollJobRow, "jobDay" | "registration" | "driver" | "trips">[];
}): TollCopyGroup[] {
  return [...jobs]
    .sort((a, b) => a.jobDay.localeCompare(b.jobDay))
    .map((job) => ({
      day: job.jobDay,
      registration: job.registration,
      driver: job.driver,
      trips: job.trips,
    }));
}

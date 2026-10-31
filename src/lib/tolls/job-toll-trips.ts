import type { TollTrip } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getJobDay,
  getTollRoad,
  matchTollTripsToJobs,
  normaliseRegistration,
  type TollTripMatch,
} from "@/lib/tolls/toll-matching";
import { addDaysToIsoDate } from "@/lib/utils/jobs-report-dates";
import type { JobTollsResponse, TollJobTrip } from "@/lib/tolls/toll-types";

const DAY_MS = 24 * 60 * 60 * 1000;

type StoredTollTrip = Pick<TollTrip, "id" | "tripStart" | "tripEnd" | "tripDetails" | "amount">;

const jobTollSelect = {
  id: true,
  date: true,
  driver: true,
  customer: true,
  registration: true,
  startTime: true,
  finishTime: true,
  citylink: true,
  eastlink: true,
} as const;

function toJobTollTrip({ trip }: { trip: StoredTollTrip }): TollJobTrip {
  return {
    id: trip.id,
    tripStart: trip.tripStart.toISOString(),
    tripEnd: trip.tripEnd?.toISOString() ?? null,
    tripDetails: trip.tripDetails,
    road: getTollRoad({ tripDetails: trip.tripDetails }),
    amount: Number(trip.amount),
  };
}

/** The matched trips of each job, keyed by job ID, in trip time order */
export function groupTripsByMatchedJob({
  trips,
  matches,
}: {
  trips: StoredTollTrip[];
  matches: TollTripMatch[];
}): Map<number, TollJobTrip[]> {
  const jobIdByTripId = new Map(
    matches.flatMap((match) => (match.jobId ? [[match.tripId, match.jobId] as const] : [])),
  );
  const tripsByJobId = new Map<number, TollJobTrip[]>();

  for (const trip of [...trips].sort((a, b) => a.tripStart.getTime() - b.tripStart.getTime())) {
    const jobId = jobIdByTripId.get(trip.id);
    if (!jobId) continue;
    tripsByJobId.set(jobId, [...(tripsByJobId.get(jobId) ?? []), toJobTollTrip({ trip })]);
  }

  return tripsByJobId;
}

function toMatchableJob<
  TJob extends { date: Date; startTime: Date | null; finishTime: Date | null },
>({ job }: { job: TJob }) {
  return {
    ...job,
    date: job.date.toISOString(),
    startTime: job.startTime?.toISOString() ?? null,
    finishTime: job.finishTime?.toISOString() ?? null,
  };
}

/**
 * The Linkt trips matched to one job, or null when the job does not exist.
 * Trips are matched against every job the same vehicle did from the day
 * before to the day after, the same way the tolls page matches them, so a
 * trip claimed by a neighbouring job is not counted twice. Job dates may be
 * saved as Melbourne midnight (the previous day in UTC), so the job query
 * reaches a day further each way before filtering by job day.
 */
export async function loadJobTolls({ jobId }: { jobId: number }): Promise<JobTollsResponse | null> {
  const storedJob = await prisma.jobs.findUnique({
    where: { id: jobId },
    select: jobTollSelect,
  });
  if (!storedJob) return null;

  const job = toMatchableJob({ job: storedJob });
  const jobDay = getJobDay({ job });
  const registration = normaliseRegistration({ registration: job.registration });
  const jobDayStart = Date.parse(`${jobDay}T00:00:00.000Z`);

  const [candidateJobs, candidateTrips] = await Promise.all([
    prisma.jobs.findMany({
      where: {
        date: {
          gte: new Date(jobDayStart - 2 * DAY_MS),
          lt: new Date(jobDayStart + 3 * DAY_MS),
        },
      },
      select: jobTollSelect,
    }),
    prisma.tollTrip.findMany({
      where: {
        registration: { not: null },
        tripStart: {
          gte: new Date(jobDayStart),
          lt: new Date(jobDayStart + 2 * DAY_MS),
        },
      },
      orderBy: { tripStart: "asc" },
    }),
  ]);

  const dayBefore = addDaysToIsoDate({ isoDate: jobDay, days: -1 });
  const dayAfter = addDaysToIsoDate({ isoDate: jobDay, days: 1 });
  const vehicleJobs = candidateJobs
    .map((candidate) => toMatchableJob({ job: candidate }))
    .filter((candidate) => {
      if (normaliseRegistration({ registration: candidate.registration }) !== registration) {
        return false;
      }
      const day = getJobDay({ job: candidate });
      return day >= dayBefore && day <= dayAfter;
    });
  if (!vehicleJobs.some((candidate) => candidate.id === job.id)) vehicleJobs.push(job);

  const vehicleTrips = candidateTrips.filter(
    (trip) =>
      trip.registration !== null &&
      normaliseRegistration({ registration: trip.registration }) === registration,
  );

  const { matches, reconciliation } = matchTollTripsToJobs({
    trips: vehicleTrips.map((trip) => ({
      id: trip.id,
      registration: trip.registration,
      tripStart: trip.tripStart.toISOString(),
      tripDetails: trip.tripDetails,
      amount: Number(trip.amount),
    })),
    jobs: vehicleJobs,
  });
  const totals = reconciliation.find((row) => row.jobId === job.id);

  return {
    jobId: job.id,
    jobDay,
    registration: job.registration,
    driver: job.driver,
    customer: job.customer,
    recordedCitylink: job.citylink ?? 0,
    recordedEastlink: job.eastlink ?? 0,
    actualCitylink: totals?.actualCitylink ?? 0,
    actualEastlink: totals?.actualEastlink ?? 0,
    tollCost: totals?.tollCost ?? 0,
    isMismatch: totals?.isMismatch ?? false,
    trips: groupTripsByMatchedJob({ trips: vehicleTrips, matches }).get(job.id) ?? [],
  };
}

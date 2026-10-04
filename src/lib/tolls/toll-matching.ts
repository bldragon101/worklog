import { addDaysToIsoDate } from "@/lib/utils/jobs-report-dates";

export type TollRoad = "citylink" | "eastlink";

export type TollMatchStatus = "matched" | "no-job" | "unknown-vehicle";

export interface MatchableTollTrip {
  id: number;
  registration: string | null;
  /** UTC-literal ISO string of the trip start */
  tripStart: string;
  tripDetails: string;
  amount: number;
}

export interface MatchableJob {
  id: number;
  date: string;
  registration: string;
  startTime: string | null;
  finishTime: string | null;
  citylink: number | null;
  eastlink: number | null;
}

export interface TollTripMatch {
  tripId: number;
  status: TollMatchStatus;
  jobId: number | null;
}

export interface TollJobReconciliation {
  jobId: number;
  jobDay: string;
  recordedCitylink: number;
  recordedEastlink: number;
  actualCitylink: number;
  actualEastlink: number;
  tollCost: number;
  isMismatch: boolean;
}

/** Minutes either side of a job's start/finish in which a toll still counts */
const JOB_WINDOW_SLACK_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;

const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** Upper-case a registration and strip spaces and punctuation */
export function normaliseRegistration({
  registration,
}: {
  registration: string;
}): string {
  return registration.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** EastLink trips are listed with an "EL " prefix; everything else is CityLink */
export function getTollRoad({ tripDetails }: { tripDetails: string }): TollRoad {
  return /^EL\s/i.test(tripDetails.trim()) ? "eastlink" : "citylink";
}

/**
 * The calendar day a job was worked. Job dates are saved either as UTC
 * midnight or as Melbourne midnight in UTC (the previous day at 13:00/14:00),
 * so the date is rounded to the nearest midnight. A start time wins when set.
 */
export function getJobDay({
  job,
}: {
  job: Pick<MatchableJob, "date" | "startTime">;
}): string {
  if (job.startTime && ISO_DATE_TIME_PATTERN.test(job.startTime)) {
    return job.startTime.slice(0, 10);
  }
  const rounded = Date.parse(job.date) + 12 * 60 * 60 * 1000;
  if (Number.isNaN(rounded)) return job.date.slice(0, 10);
  return new Date(rounded).toISOString().slice(0, 10);
}

/** Minutes since the epoch for a UTC-literal ISO string, without time zone conversion */
function toEpochMinutes({ iso }: { iso: string }): number | null {
  const match = iso.match(ISO_DATE_TIME_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return (
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) /
    60000
  );
}

/**
 * A job's start and finish in epoch minutes, or null when neither is set.
 * Both times are saved against the job's date, so a finish earlier than the
 * start is an overnight job finishing the next morning.
 */
function getJobWindow({
  job,
}: {
  job: Pick<MatchableJob, "startTime" | "finishTime">;
}): { start: number; finish: number } | null {
  const start = job.startTime ? toEpochMinutes({ iso: job.startTime }) : null;
  const savedFinish = job.finishTime ? toEpochMinutes({ iso: job.finishTime }) : null;
  const finish =
    start !== null && savedFinish !== null && savedFinish < start
      ? savedFinish + MINUTES_PER_DAY
      : savedFinish;

  if (start === null && finish === null) return null;
  return { start: start ?? finish ?? 0, finish: finish ?? start ?? 0 };
}

function isOvernightJob({ job }: { job: MatchableJob }): boolean {
  const window = getJobWindow({ job });
  if (!window) return false;
  return Math.floor(window.finish / MINUTES_PER_DAY) > Math.floor(window.start / MINUTES_PER_DAY);
}

/**
 * How far a trip falls outside a job's start/finish window, in minutes.
 * 0 when inside; Infinity when the job has no times recorded.
 */
function minutesOutsideJobWindow({
  job,
  tripMinutes,
}: {
  job: MatchableJob;
  tripMinutes: number;
}): number {
  const window = getJobWindow({ job });
  if (!window) return Number.POSITIVE_INFINITY;

  const windowStart = window.start - JOB_WINDOW_SLACK_MINUTES;
  const windowEnd = window.finish + JOB_WINDOW_SLACK_MINUTES;
  if (tripMinutes < windowStart) return windowStart - tripMinutes;
  if (tripMinutes > windowEnd) return tripMinutes - windowEnd;
  return 0;
}

function pickJobForTrip({
  candidates,
  trip,
}: {
  candidates: MatchableJob[];
  trip: MatchableTollTrip;
}): MatchableJob | null {
  if (candidates.length <= 1) return candidates[0] ?? null;

  const tripMinutes = toEpochMinutes({ iso: trip.tripStart });
  if (tripMinutes === null) return candidates[0];

  let best = candidates[0];
  let bestDistance = minutesOutsideJobWindow({ job: best, tripMinutes });
  for (const job of candidates.slice(1)) {
    const distance = minutesOutsideJobWindow({ job, tripMinutes });
    if (distance < bestDistance) {
      best = job;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Match each toll trip to the job its vehicle was on that day. When the
 * vehicle did several jobs that day, the job whose start/finish window is
 * closest to the trip wins. A trip after midnight can also match the previous
 * day's overnight job when it falls inside that job's window. Also counts the
 * CityLink and EastLink trips per job and flags jobs whose recorded toll
 * counts differ from Linkt.
 */
export function matchTollTripsToJobs({
  trips,
  jobs,
}: {
  trips: MatchableTollTrip[];
  jobs: MatchableJob[];
}): { matches: TollTripMatch[]; reconciliation: TollJobReconciliation[] } {
  const jobsByVehicleDay = new Map<string, MatchableJob[]>();
  const overnightJobsByVehicleNextDay = new Map<string, MatchableJob[]>();
  const addToGroup = ({
    groups,
    key,
    job,
  }: {
    groups: Map<string, MatchableJob[]>;
    key: string;
    job: MatchableJob;
  }) => {
    groups.set(key, [...(groups.get(key) ?? []), job]);
  };

  for (const job of jobs) {
    const registration = normaliseRegistration({ registration: job.registration });
    const jobDay = getJobDay({ job });
    addToGroup({ groups: jobsByVehicleDay, key: `${registration}|${jobDay}`, job });
    if (isOvernightJob({ job })) {
      const nextDay = addDaysToIsoDate({ isoDate: jobDay, days: 1 });
      addToGroup({ groups: overnightJobsByVehicleNextDay, key: `${registration}|${nextDay}`, job });
    }
  }

  const totals = new Map<
    number,
    { citylink: number; eastlink: number; cost: number }
  >();
  const matches: TollTripMatch[] = [];

  for (const trip of trips) {
    if (!trip.registration) {
      matches.push({ tripId: trip.id, status: "unknown-vehicle", jobId: null });
      continue;
    }

    const key = `${normaliseRegistration({ registration: trip.registration })}|${trip.tripStart.slice(0, 10)}`;
    const tripMinutes = toEpochMinutes({ iso: trip.tripStart });
    const overnightCandidates = (overnightJobsByVehicleNextDay.get(key) ?? []).filter(
      (job) => tripMinutes !== null && minutesOutsideJobWindow({ job, tripMinutes }) === 0,
    );
    const job = pickJobForTrip({
      candidates: [...(jobsByVehicleDay.get(key) ?? []), ...overnightCandidates],
      trip,
    });
    if (!job) {
      matches.push({ tripId: trip.id, status: "no-job", jobId: null });
      continue;
    }

    matches.push({ tripId: trip.id, status: "matched", jobId: job.id });
    const total = totals.get(job.id) ?? { citylink: 0, eastlink: 0, cost: 0 };
    total[getTollRoad({ tripDetails: trip.tripDetails })] += 1;
    total.cost = Math.round((total.cost + trip.amount) * 100) / 100;
    totals.set(job.id, total);
  }

  const reconciliation: TollJobReconciliation[] = [];
  for (const job of jobs) {
    const total = totals.get(job.id) ?? { citylink: 0, eastlink: 0, cost: 0 };
    const recordedCitylink = job.citylink ?? 0;
    const recordedEastlink = job.eastlink ?? 0;
    const hasTolls =
      total.citylink + total.eastlink + recordedCitylink + recordedEastlink > 0;
    if (!hasTolls) continue;

    reconciliation.push({
      jobId: job.id,
      jobDay: getJobDay({ job }),
      recordedCitylink,
      recordedEastlink,
      actualCitylink: total.citylink,
      actualEastlink: total.eastlink,
      tollCost: total.cost,
      isMismatch:
        recordedCitylink !== total.citylink ||
        recordedEastlink !== total.eastlink,
    });
  }

  return { matches, reconciliation };
}

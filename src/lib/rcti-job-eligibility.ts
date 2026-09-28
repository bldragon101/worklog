import { endOfWeek, startOfWeek } from "date-fns";
import { Prisma } from "@/generated/prisma/client";

/**
 * Monday to Sunday range of the week an RCTI covers.
 */
export function getRctiWeekRange({ weekEnding }: { weekEnding: Date }) {
  const weekEndingDate = new Date(weekEnding);
  return {
    weekStart: startOfWeek(weekEndingDate, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(weekEndingDate, { weekStartsOn: 1 }),
  };
}

/**
 * Lock the given job rows until the transaction ends, so two requests cannot
 * put the same job on RCTIs at the same time. Rows are locked in id order to
 * avoid deadlocks between overlapping requests.
 */
export async function lockJobsForRcti({
  tx,
  jobIds,
}: {
  tx: Prisma.TransactionClient;
  jobIds: number[];
}) {
  if (jobIds.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Jobs" WHERE id IN (${Prisma.join(jobIds)}) ORDER BY id FOR UPDATE`;
}

/**
 * Ids of the given jobs that already have a line on an RCTI, and which RCTI.
 */
export async function getJobsOnRctis({
  tx,
  jobIds,
}: {
  tx: Prisma.TransactionClient;
  jobIds: number[];
}) {
  const jobRctis = new Map<number, number>();
  if (jobIds.length === 0) return jobRctis;

  const lines = await tx.rctiLine.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true, rctiId: true },
  });
  for (const line of lines) {
    if (line.jobId !== null) {
      jobRctis.set(line.jobId, line.rctiId);
    }
  }
  return jobRctis;
}

interface RctiDriver {
  id: number;
  driver: string;
  truck: string;
  type: string;
}

interface CandidateJob {
  id: number;
  date: Date;
  driver: string;
  registration: string;
}

/**
 * Names of drivers on record who are paid outside this subcontractor's RCTI:
 * employees are paid through payroll and contractors on their own RCTIs.
 */
async function getNamesPaidElsewhere({
  tx,
  driver,
  jobs,
}: {
  tx: Prisma.TransactionClient;
  driver: RctiDriver;
  jobs: CandidateJob[];
}) {
  if (driver.type !== "Subcontractor" || jobs.length === 0) {
    return new Set<string>();
  }
  const others = await tx.driver.findMany({
    where: {
      driver: { in: Array.from(new Set(jobs.map((job) => job.driver))) },
      type: { in: ["Employee", "Contractor"] },
      id: { not: driver.id },
    },
    select: { driver: true },
  });
  return new Set(others.map((other) => other.driver));
}

/**
 * Why a job cannot be added to an RCTI, or null when it can.
 *
 * Contractors' jobs are matched by driver name. Subcontractors' jobs may be
 * in any truck, since their workers can drive a truck other than the one on
 * the subcontractor's record, but not a job recorded against an employee or
 * contractor.
 */
function getIneligibleReason({
  job,
  rctiId,
  driver,
  weekStart,
  weekEnd,
  jobRctis,
  namesPaidElsewhere,
}: {
  job: CandidateJob;
  rctiId: number;
  driver: RctiDriver;
  weekStart: Date;
  weekEnd: Date;
  jobRctis: Map<number, number>;
  namesPaidElsewhere: Set<string>;
}) {
  const onRctiId = jobRctis.get(job.id);
  if (onRctiId === rctiId) {
    return "is already on this RCTI";
  }
  if (onRctiId !== undefined) {
    return "is already on another RCTI";
  }
  const jobDate = new Date(job.date);
  if (jobDate < weekStart || jobDate > weekEnd) {
    return "is not in this RCTI's week";
  }
  if (driver.type === "Subcontractor") {
    if (namesPaidElsewhere.has(job.driver)) {
      return `belongs to ${job.driver}, who is paid separately`;
    }
    return null;
  }
  if (job.driver !== driver.driver) {
    return `belongs to ${job.driver}, not ${driver.driver}`;
  }
  return null;
}

/**
 * Split jobs into those that can be added to an RCTI and those that cannot,
 * with a reason for each rejected job.
 */
export async function checkJobsForRcti<Job extends CandidateJob>({
  tx,
  rctiId,
  weekEnding,
  driver,
  jobs,
}: {
  tx: Prisma.TransactionClient;
  rctiId: number;
  weekEnding: Date;
  driver: RctiDriver;
  jobs: Job[];
}) {
  const { weekStart, weekEnd } = getRctiWeekRange({ weekEnding });
  const jobRctis = await getJobsOnRctis({
    tx,
    jobIds: jobs.map((job) => job.id),
  });
  const namesPaidElsewhere = await getNamesPaidElsewhere({
    tx,
    driver,
    jobs,
  });

  const eligible: Job[] = [];
  const rejected: Array<{ jobId: number; reason: string }> = [];
  for (const job of jobs) {
    const reason = getIneligibleReason({
      job,
      rctiId,
      driver,
      weekStart,
      weekEnd,
      jobRctis,
      namesPaidElsewhere,
    });
    if (reason) {
      rejected.push({ jobId: job.id, reason: `Job ${job.id} ${reason}` });
    } else {
      eligible.push(job);
    }
  }

  return { eligible, rejected };
}

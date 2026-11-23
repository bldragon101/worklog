import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Jobs, Prisma } from "@/generated/prisma/client";
import {
  getLineHoursWithoutDeduction,
  getTotalDriverHours,
} from "@/lib/utils/rcti-calculations";

const MELBOURNE_TZ = "Australia/Melbourne";

function toMelbourneDateUTC({ date }: { date: Date }): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(dateStr + "T00:00:00.000Z");
}

function formatTimeUTC({ date }: { date: Date }): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Finds the driver's jobs in the report's week (Monday to the week ending).
 * Subcontractors are matched by their truck's registration, everyone else by
 * name.
 */
export function findJobsForReport({
  db,
  driver,
  weekEnding,
}: {
  db: Prisma.TransactionClient;
  driver: { driver: string; truck: string; type: string };
  weekEnding: Date;
}): Promise<Jobs[]> {
  const weekStart = startOfWeek(weekEnding, { weekStartsOn: 1 });

  return db.jobs.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnding },
      ...(driver.type === "Subcontractor"
        ? { registration: driver.truck }
        : { driver: driver.driver }),
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
}

/**
 * Builds a report line for each job, showing the hours the driver is paid. A
 * job whose deduction is hidden shows only the paid hours, with no deduction.
 */
export function buildJobsReportLines({ jobs }: { jobs: Jobs[] }) {
  return jobs.map((job) => {
    const driverHours = getTotalDriverHours({
      chargedHours: job.chargedHours,
      travelTimeHours: job.travelTimeHours,
      driverCharge: job.driverCharge,
      deductionHours: job.deductionHours,
    });
    const lineHours = job.hideDeduction
      ? getLineHoursWithoutDeduction({
          chargedHours: job.chargedHours,
          travelTimeHours: job.travelTimeHours,
          totalDriverHours: driverHours,
        })
      : {
          chargedHours: job.chargedHours ?? null,
          travelTimeHours: job.travelTimeHours ?? null,
        };

    return {
      jobId: job.id,
      jobDate: toMelbourneDateUTC({ date: job.date }),
      customer: job.customer,
      truckType: job.truckType,
      startTime: job.startTime ? formatTimeUTC({ date: job.startTime }) : null,
      finishTime: job.finishTime
        ? formatTimeUTC({ date: job.finishTime })
        : null,
      chargedHours: lineHours.chargedHours,
      travelTimeHours: lineHours.travelTimeHours,
      driverCharge: driverHours,
    };
  });
}

/**
 * Relations returned with a jobs report to the jobs report page.
 */
export const jobsReportInclude = {
  driver: {
    select: {
      id: true,
      driver: true,
      email: true,
    },
  },
  lines: {
    orderBy: { jobDate: "asc" },
  },
  deductionApplications: {
    include: {
      deduction: {
        select: {
          id: true,
          type: true,
          description: true,
          frequency: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.JobsReportInclude;

/**
 * Loads a jobs report with its driver, lines and applied deductions.
 */
export function findJobsReport({ reportId }: { reportId: number }) {
  return prisma.jobsReport.findUnique({
    where: { id: reportId },
    include: jobsReportInclude,
  });
}

/**
 * Runs a change to a jobs report's lines only while the report
 * is still a draft. The report row is touched first in the same transaction,
 * so a finalise that lands mid-request cannot slip in between the status check
 * and the change. Returns false when the report is no longer a draft.
 */
export async function changeDraftJobsReport({
  reportId,
  change,
}: {
  reportId: number;
  change: ({ tx }: { tx: Prisma.TransactionClient }) => Promise<void>;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const draftGuard = await tx.jobsReport.updateMany({
      where: { id: reportId, status: "draft" },
      data: { updatedAt: new Date() },
    });
    if (draftGuard.count === 0) return false;

    await change({ tx });
    return true;
  });
}

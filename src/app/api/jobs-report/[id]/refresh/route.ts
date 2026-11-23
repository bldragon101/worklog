import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  buildJobsReportLines,
  changeDraftJobsReport,
  findJobsForReport,
  findJobsReport,
} from "@/lib/jobs-report";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/jobs-report/[id]/refresh
 * Rebuild a draft Jobs Report's job lines from the current jobs in its week.
 *
 * Newly added jobs are picked up, edited jobs are updated and jobs that no
 * longer match the driver and week are dropped. Manual lines are kept. Only
 * draft Jobs Reports can be refreshed.
 */
export const POST = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error refreshing Jobs Report",
  responseMessage: "Failed to refresh Jobs Report",
  handler: async ({ params: { id: reportId } }) => {
    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      select: { status: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft Jobs Reports can be refreshed" },
        { status: 400 },
      );
    }

    // The draft check, reading the jobs and replacing the lines happen in one
    // transaction, so a finalise that lands mid-refresh either waits for it or
    // stops it.
    const refreshed = await changeDraftJobsReport({
      reportId,
      change: async ({ tx }) => {
        const { driver, weekEnding } = await tx.jobsReport.findUniqueOrThrow({
          where: { id: reportId },
          select: {
            weekEnding: true,
            driver: { select: { driver: true, truck: true, type: true } },
          },
        });

        const jobs = await findJobsForReport({ db: tx, driver, weekEnding });

        await tx.jobsReportLine.deleteMany({
          where: { reportId, jobId: { not: null } },
        });

        if (jobs.length > 0) {
          await tx.jobsReportLine.createMany({
            data: buildJobsReportLines({ jobs }).map((line) => ({
              ...line,
              reportId,
            })),
          });
        }
      },
    });

    if (!refreshed) {
      return NextResponse.json(
        { error: "Only draft Jobs Reports can be refreshed" },
        { status: 409 },
      );
    }

    const updatedReport = await findJobsReport({ reportId });

    return NextResponse.json(updatedReport);
  },
});

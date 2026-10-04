import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { checkJobsForRcti, getRctiWeekRange } from "@/lib/rcti-job-eligibility";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * GET /api/rcti/[id]/available-jobs
 * Jobs that can be added to a draft RCTI with "Add Jobs": jobs in the RCTI's
 * week that are not on any RCTI yet. Contractors see their own jobs.
 * Subcontractors see jobs in any truck, with jobs in their own truck first.
 */
export const GET = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error fetching available jobs for RCTI",
  responseMessage: "Failed to fetch available jobs",
  handler: async ({ params: { id: rctiId } }) => {
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { driver: true },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "draft") {
      return NextResponse.json([]);
    }

    const { weekStart, weekEnd } = getRctiWeekRange({
      weekEnding: rcti.weekEnding,
    });
    const isSubcontractor = rcti.driver.type === "Subcontractor";

    const jobsInWeek = await prisma.jobs.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        ...(isSubcontractor ? {} : { driver: rcti.driver.driver }),
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const { eligible } = await checkJobsForRcti({
      tx: prisma,
      rctiId,
      weekEnding: rcti.weekEnding,
      driver: rcti.driver,
      jobs: jobsInWeek,
    });

    const ownTruckFirst = isSubcontractor
      ? [
          ...eligible.filter((job) => job.registration === rcti.driver.truck),
          ...eligible.filter((job) => job.registration !== rcti.driver.truck),
        ]
      : eligible;

    return NextResponse.json(ownTruckFirst);
  },
});

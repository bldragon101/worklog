import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import {
  checkJobsForRcti,
  getRctiWeekRange,
} from "@/lib/rcti-job-eligibility";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti/[id]/available-jobs
 * Jobs that can be added to a draft RCTI with "Add Jobs": jobs in the RCTI's
 * week that are not on any RCTI yet. Contractors see their own jobs.
 * Subcontractors see jobs in any truck, with jobs in their own truck first.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireRctiAccess({
    headers: rateLimitResult.headers,
  });
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const rctiId = parseInt(id, 10);

    if (isNaN(rctiId) || rctiId <= 0) {
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { driver: true },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status !== "draft") {
      return NextResponse.json([], { headers: rateLimitResult.headers });
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

    return NextResponse.json(ownTruckFirst, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error fetching available jobs for RCTI:", error);
    return NextResponse.json(
      { error: "Failed to fetch available jobs" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import {
  calculateRctiTotals,
  toNumber,
} from "@/lib/utils/rcti-calculations";
import {
  buildRctiLinesFromJobs,
  isManualRctiLine,
  type BuiltRctiLine,
} from "@/lib/rcti-line-builder";
import {
  getRctiWeekRange,
  lockJobsForRcti,
} from "@/lib/rcti-job-eligibility";
import { lockRcti, RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/rcti/[id]/refresh
 * Rebuild a draft RCTI's lines from the current source jobs.
 *
 * Regenerates job lines, lunch-break deductions, toll lines and the fuel levy
 * line from the jobs that fall in the RCTI's week. Newly added jobs are picked
 * up and jobs that no longer exist are dropped. Jobs already on the RCTI are
 * kept, including ones added from another truck. Manually-added lines are
 * preserved. Only draft RCTIs can be refreshed.
 */
export async function POST(
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

    if (isNaN(rctiId)) {
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Lock the RCTI, then read its lines and replace them in one
    // transaction. A line deleted or edited during a refresh either happens
    // before it (and the refresh sees it) or waits for it to finish, so a
    // deleted line can never come back.
    const outcome = await prisma.$transaction(async (tx) => {
      const lockedStatus = await lockRcti({ tx, rctiId });
      if (lockedStatus === null) {
        return { status: 404, error: "RCTI not found" };
      }
      if (lockedStatus !== "draft") {
        return { status: 400, error: "Only draft RCTIs can be refreshed" };
      }

      const rcti = await tx.rcti.findUniqueOrThrow({
        where: { id: rctiId },
        include: { lines: true, driver: true },
      });
      const { driver } = rcti;

      const weekEndingDate = new Date(rcti.weekEnding);
      const { weekStart, weekEnd } = getRctiWeekRange({
        weekEnding: weekEndingDate,
      });

      // Find jobs for this driver and week.
      // Subcontractors match by registration (= driver.truck), others by name.
      const jobWhereClause: {
        driver?: string;
        registration?: string;
        date: { gte: Date; lte: Date };
      } = {
        date: { gte: weekStart, lte: weekEnd },
      };

      if (driver.type === "Subcontractor") {
        jobWhereClause.registration = driver.truck;
      } else {
        jobWhereClause.driver = driver.driver;
      }

      // Jobs added with "Add Jobs" stay on the RCTI even when they don't
      // match the driver's name or truck (a subcontractor's job in another
      // truck).
      const addedJobIds = rcti.lines
        .map((line) => line.jobId)
        .filter((jobId): jobId is number => jobId !== null);

      const jobs = await tx.jobs.findMany({
        where: {
          OR: [
            jobWhereClause,
            {
              id: { in: addedJobIds },
              date: { gte: weekStart, lte: weekEnd },
            },
          ],
        },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      });

      // Exclude jobs already attached to OTHER RCTIs (not this one), locking
      // them so another RCTI cannot take them while this one is rebuilt.
      const candidateJobIds = jobs.map((job) => job.id);
      await lockJobsForRcti({ tx, jobIds: candidateJobIds });
      const usedElsewhere = new Set<number>();
      if (candidateJobIds.length > 0) {
        const linesOnOtherRctis = await tx.rctiLine.findMany({
          where: {
            rctiId: { not: rctiId },
            jobId: { in: candidateJobIds },
          },
          select: { jobId: true },
        });
        for (const line of linesOnOtherRctis) {
          if (line.jobId !== null) {
            usedElsewhere.add(line.jobId);
          }
        }
      }

      const eligibleJobs = jobs.filter((job) => !usedElsewhere.has(job.id));

      // Build fresh auto-generated lines from the source jobs
      const autoLines = buildRctiLinesFromJobs({
        eligibleJobs,
        driver: {
          type: driver.type,
          tray: driver.tray ? toNumber(driver.tray) : null,
          crane: driver.crane ? toNumber(driver.crane) : null,
          semi: driver.semi ? toNumber(driver.semi) : null,
          semiCrane: driver.semiCrane ? toNumber(driver.semiCrane) : null,
          breaks: driver.breaks,
          tolls: driver.tolls,
          fuelLevy: driver.fuelLevy,
        },
        weekEndingDate,
        gstStatus: rcti.gstStatus as "registered" | "not_registered",
        gstMode: rcti.gstMode as "exclusive" | "inclusive",
      });

      // Preserve manually-added lines (no jobId, not a system label)
      const manualLines: BuiltRctiLine[] = rcti.lines
        .filter((line) =>
          isManualRctiLine({ jobId: line.jobId, customer: line.customer }),
        )
        .map((line) => ({
          jobId: null,
          jobDate: line.jobDate,
          customer: line.customer,
          truckType: line.truckType,
          description: line.description,
          chargedHours: toNumber(line.chargedHours),
          travelTimeHours:
            line.travelTimeHours === null
              ? 0
              : toNumber(line.travelTimeHours),
          driverCharge:
            line.driverCharge === null ? null : toNumber(line.driverCharge),
          ratePerHour: toNumber(line.ratePerHour),
          amountExGst: toNumber(line.amountExGst),
          gstAmount: toNumber(line.gstAmount),
          amountIncGst: toNumber(line.amountIncGst),
        }));

      const allLines = [...autoLines, ...manualLines];
      const totals = calculateRctiTotals(allLines);

      await tx.rctiLine.deleteMany({ where: { rctiId } });

      if (allLines.length > 0) {
        await tx.rctiLine.createMany({
          data: allLines.map((line) => ({ ...line, rctiId })),
        });
      }

      const updatedRcti = await tx.rcti.update({
        where: { id: rctiId },
        data: {
          subtotal: totals.subtotal,
          gst: totals.gst,
          total: totals.total,
        },
        include: {
          driver: true,
          lines: {
            orderBy: { jobDate: "asc" },
          },
        },
      });

      return { updatedRcti };
    }, RCTI_TRANSACTION_OPTIONS);

    if ("error" in outcome) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status, headers: rateLimitResult.headers },
      );
    }
    const { updatedRcti } = outcome;

    return NextResponse.json(updatedRcti, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error refreshing RCTI:", error);
    return NextResponse.json(
      { error: "Failed to refresh RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

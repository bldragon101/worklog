import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { startOfWeek, endOfWeek } from "date-fns";
import {
  calculateRctiTotals,
  toNumber,
} from "@/lib/utils/rcti-calculations";
import {
  buildRctiLinesFromJobs,
  isManualRctiLine,
  type BuiltRctiLine,
} from "@/lib/rcti-line-builder";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/rcti/[id]/refresh
 * Rebuild a draft RCTI's lines from the current source jobs.
 *
 * Regenerates job lines, lunch-break deductions, toll lines and the fuel levy
 * line from the jobs that fall in the RCTI's week. Newly added jobs are picked
 * up and jobs that no longer exist are dropped. Manually-added lines are
 * preserved. Only draft RCTIs can be refreshed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
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

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { lines: true },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCTIs can be refreshed" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { id: rcti.driverId },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found for this RCTI" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    const weekEndingDate = new Date(rcti.weekEnding);
    const weekStart = startOfWeek(weekEndingDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekEndingDate, { weekStartsOn: 1 });

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

    const jobs = await prisma.jobs.findMany({
      where: jobWhereClause,
      orderBy: { date: "asc" },
    });

    // Exclude jobs already attached to OTHER RCTIs (not this one)
    const linesOnOtherRctis = await prisma.rctiLine.findMany({
      where: { rctiId: { not: rctiId }, jobId: { not: null } },
      select: { jobId: true },
    });
    const usedElsewhere = new Set(
      linesOnOtherRctis
        .map((l) => l.jobId)
        .filter((jobId): jobId is number => jobId !== null),
    );

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
        ratePerHour: toNumber(line.ratePerHour),
        amountExGst: toNumber(line.amountExGst),
        gstAmount: toNumber(line.gstAmount),
        amountIncGst: toNumber(line.amountIncGst),
      }));

    const allLines = [...autoLines, ...manualLines];
    const totals = calculateRctiTotals(allLines);

    // Replace lines and update totals atomically
    const updatedRcti = await prisma.$transaction(async (tx) => {
      await tx.rctiLine.deleteMany({ where: { rctiId } });

      if (allLines.length > 0) {
        await tx.rctiLine.createMany({
          data: allLines.map((line) => ({ ...line, rctiId })),
        });
      }

      return tx.rcti.update({
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
    });

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

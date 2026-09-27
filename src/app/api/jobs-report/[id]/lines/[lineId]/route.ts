import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * DELETE /api/jobs-report/[id]/lines/[lineId]
 * Remove a manual line from a draft Jobs Report. Lines built from jobs are
 * managed on the jobs page and cannot be removed here.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

  try {
    const { id, lineId } = await params;
    const reportId = parseInt(id, 10);
    const parsedLineId = parseInt(lineId, 10);

    if (isNaN(reportId) || isNaN(parsedLineId)) {
      return NextResponse.json(
        { error: "Invalid report or line ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const line = await prisma.jobsReportLine.findFirst({
      where: { id: parsedLineId, reportId },
      include: { report: { select: { status: true } } },
    });

    if (!line) {
      return NextResponse.json(
        { error: "Line not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (line.report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only remove lines from draft Jobs Reports" },
        { status: 409, headers: rateLimitResult.headers },
      );
    }

    if (line.jobId !== null) {
      return NextResponse.json(
        { error: "Only manual lines can be removed" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const removed = await prisma.$transaction(async (tx) => {
      const draftGuard = await tx.jobsReport.updateMany({
        where: { id: reportId, status: "draft" },
        data: { updatedAt: new Date() },
      });
      if (draftGuard.count === 0) return false;

      await tx.jobsReportLine.deleteMany({
        where: { id: parsedLineId, reportId, jobId: null },
      });
      return true;
    });

    if (!removed) {
      return NextResponse.json(
        { error: "Can only remove lines from draft Jobs Reports" },
        { status: 409, headers: rateLimitResult.headers },
      );
    }

    const updatedReport = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      include: {
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
      },
    });

    return NextResponse.json(updatedReport, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error removing Jobs Report line:", error);
    return NextResponse.json(
      { error: "Failed to remove line" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

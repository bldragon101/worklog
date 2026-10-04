import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { apiRoute, positiveIntParam } from "@/lib/api-route";
import { z } from "zod";

/**
 * DELETE /api/jobs-report/[id]/lines/[lineId]
 * Remove a manual line from a draft Jobs Report. Lines built from jobs are
 * managed on the jobs page and cannot be removed here.
 */
export const DELETE = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  params: z.object({
    id: positiveIntParam({ message: "Invalid report or line ID" }),
    lineId: positiveIntParam({ message: "Invalid report or line ID" }),
  }),
  errorMessage: "Error removing Jobs Report line",
  responseMessage: "Failed to remove line",
  handler: async ({ params: { id: reportId, lineId: parsedLineId } }) => {
    const line = await prisma.jobsReportLine.findFirst({
      where: { id: parsedLineId, reportId },
      include: { report: { select: { status: true } } },
    });

    if (!line) {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    if (line.report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only remove lines from draft Jobs Reports" },
        { status: 409 },
      );
    }

    if (line.jobId !== null) {
      return NextResponse.json(
        { error: "Only manual lines can be removed" },
        { status: 400 },
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
        { status: 409 },
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

    return NextResponse.json(updatedReport);
  },
});

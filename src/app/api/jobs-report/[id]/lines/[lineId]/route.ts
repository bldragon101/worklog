import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiRoute, positiveIntParam } from "@/lib/api-route";
import { changeDraftJobsReport, findJobsReport } from "@/lib/jobs-report";
import {
  manualJobsReportLineRequestSchema,
  toManualJobsReportLineData,
} from "@/lib/utils/jobs-report-validation";

const lineParams = z.object({
  id: positiveIntParam({ message: "Invalid report or line ID" }),
  lineId: positiveIntParam({ message: "Invalid report or line ID" }),
});

const adminOnly = {
  roles: ["admin" as const],
  forbiddenMessage: "Forbidden - Admin privileges required",
};

/**
 * Finds a line on a report and says why it cannot be changed, if it cannot.
 * Lines built from jobs are managed on the jobs page.
 */
async function checkManualLineEditable({
  reportId,
  lineId,
  action,
}: {
  reportId: number;
  lineId: number;
  action: "edit" | "remove";
}): Promise<NextResponse | null> {
  const line = await prisma.jobsReportLine.findFirst({
    where: { id: lineId, reportId },
    include: { report: { select: { status: true } } },
  });

  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  if (line.report.status !== "draft") {
    return NextResponse.json(
      {
        error:
          action === "edit"
            ? "Can only edit lines on draft Jobs Reports"
            : "Can only remove lines from draft Jobs Reports",
      },
      { status: 409 },
    );
  }

  if (line.jobId !== null) {
    return NextResponse.json(
      {
        error:
          action === "edit"
            ? "Only manual lines can be edited"
            : "Only manual lines can be removed",
      },
      { status: 400 },
    );
  }

  return null;
}

/**
 * PATCH /api/jobs-report/[id]/lines/[lineId]
 * Replace the details of a manual line on a draft Jobs Report.
 */
export const PATCH = apiRoute({
  auth: adminOnly,
  params: lineParams,
  errorMessage: "Error updating Jobs Report line",
  responseMessage: "Failed to update line",
  handler: async ({ request, params: { id: reportId, lineId } }) => {
    const body = await request.json().catch(() => null);
    const validation = manualJobsReportLineRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Missing or invalid fields for manual line" },
        { status: 400 },
      );
    }

    const rejection = await checkManualLineEditable({
      reportId,
      lineId,
      action: "edit",
    });
    if (rejection) return rejection;

    const updated = await changeDraftJobsReport({
      reportId,
      change: async ({ tx }) => {
        await tx.jobsReportLine.updateMany({
          where: { id: lineId, reportId, jobId: null },
          data: toManualJobsReportLineData({
            line: validation.data.manualLine,
          }),
        });
      },
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Can only edit lines on draft Jobs Reports" },
        { status: 409 },
      );
    }

    const updatedReport = await findJobsReport({ reportId });

    return NextResponse.json(updatedReport);
  },
});

/**
 * DELETE /api/jobs-report/[id]/lines/[lineId]
 * Remove a manual line from a draft Jobs Report. Lines built from jobs are
 * managed on the jobs page and cannot be removed here.
 */
export const DELETE = apiRoute({
  auth: adminOnly,
  params: lineParams,
  errorMessage: "Error removing Jobs Report line",
  responseMessage: "Failed to remove line",
  handler: async ({ params: { id: reportId, lineId } }) => {
    const rejection = await checkManualLineEditable({
      reportId,
      lineId,
      action: "remove",
    });
    if (rejection) return rejection;

    const removed = await changeDraftJobsReport({
      reportId,
      change: async ({ tx }) => {
        await tx.jobsReportLine.deleteMany({
          where: { id: lineId, reportId, jobId: null },
        });
      },
    });

    if (!removed) {
      return NextResponse.json(
        { error: "Can only remove lines from draft Jobs Reports" },
        { status: 409 },
      );
    }

    const updatedReport = await findJobsReport({ reportId });

    return NextResponse.json(updatedReport);
  },
});

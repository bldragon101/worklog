import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { apiRoute, idParams } from "@/lib/api-route";
import { changeDraftJobsReport, findJobsReport } from "@/lib/jobs-report";
import {
  manualJobsReportLineRequestSchema,
  toManualJobsReportLineData,
} from "@/lib/utils/jobs-report-validation";

/**
 * POST /api/jobs-report/[id]/lines
 * Add a manual line to a draft Jobs Report
 */
export const POST = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error adding Jobs Report line",
  responseMessage: "Failed to add manual line",
  handler: async ({ request, params: { id: reportId } }) => {
    const body = await request.json().catch(() => null);
    const validation = manualJobsReportLineRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Missing or invalid fields for manual line" },
        { status: 400 },
      );
    }

    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add lines to draft Jobs Reports" },
        { status: 409 },
      );
    }

    const added = await changeDraftJobsReport({
      reportId,
      change: async ({ tx }) => {
        await tx.jobsReportLine.create({
          data: {
            reportId,
            jobId: null,
            ...toManualJobsReportLineData({
              line: validation.data.manualLine,
            }),
          },
        });
      },
    });

    if (!added) {
      return NextResponse.json(
        { error: "Can only add lines to draft Jobs Reports" },
        { status: 409 },
      );
    }

    const updatedReport = await findJobsReport({ reportId });

    return NextResponse.json(updatedReport, {
      status: 201,
    });
  },
});

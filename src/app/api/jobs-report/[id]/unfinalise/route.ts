import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/jobs-report/[id]/unfinalise
 * Revert a finalised Jobs Report back to draft
 */
export const POST = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error unfinalising Jobs Report",
  responseMessage: "Failed to unfinalise Jobs Report",
  handler: async ({ params: { id: reportId } }) => {
    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    if (report.status === "draft") {
      return NextResponse.json(
        { error: "Jobs Report is already in draft status" },
        { status: 400 },
      );
    }

    const updatedReport = await prisma.jobsReport.update({
      where: { id: reportId },
      data: {
        status: "draft",
      },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    return NextResponse.json(updatedReport);
  },
});

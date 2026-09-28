import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/jobs-report/[id]/finalize
 * Finalise a Jobs Report (lock it from further editing)
 */
export const POST = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error finalising Jobs Report",
  responseMessage: "Failed to finalise Jobs Report",
  handler: async ({ params: { id: reportId } }) => {
    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      include: { lines: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft Jobs Reports can be finalised" },
        { status: 400 },
      );
    }

    if (report.lines.length === 0) {
      return NextResponse.json(
        { error: "Cannot finalise a Jobs Report with no lines" },
        { status: 400 },
      );
    }

    const updatedReport = await prisma.jobsReport.update({
      where: { id: reportId },
      data: {
        status: "finalised",
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

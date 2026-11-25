import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jobsReportInclude } from "@/lib/jobs-report";
import { removeDeductionsFromJobsReport } from "@/lib/rcti-deductions";
import { RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/jobs-report/[id]/unfinalise
 * Revert a finalised Jobs Report back to draft, giving the deductions it
 * applied back to the driver's balances.
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

    const updatedReport = await prisma.$transaction(async (tx) => {
      const statusChange = await tx.jobsReport.updateMany({
        where: { id: reportId, status: "finalised" },
        data: { status: "draft" },
      });
      if (statusChange.count === 0) return null;

      await removeDeductionsFromJobsReport({ reportId, tx });

      return tx.jobsReport.findUnique({
        where: { id: reportId },
        include: { ...jobsReportInclude, driver: true },
      });
    }, RCTI_TRANSACTION_OPTIONS);

    if (!updatedReport) {
      return NextResponse.json(
        { error: "Jobs Report is already in draft status" },
        { status: 409 },
      );
    }

    return NextResponse.json(updatedReport);
  },
});

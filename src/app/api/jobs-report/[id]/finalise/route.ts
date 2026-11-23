import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jobsReportInclude } from "@/lib/jobs-report";
import { applyDeductionsToJobsReport } from "@/lib/rcti-deductions";
import { parseDeductionOverrides } from "@/lib/utils/deduction-overrides";
import { RCTI_TRANSACTION_OPTIONS } from "@/lib/rcti-status";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * POST /api/jobs-report/[id]/finalise
 * Finalise a Jobs Report (lock it from further editing) and apply the
 * driver's deductions due this week. Deductions are shared with RCTIs, so a
 * cycle already applied to an RCTI is not applied again.
 * Body: { deductionOverrides?: { [deductionId: number]: number | null } }
 */
export const POST = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error finalising Jobs Report",
  responseMessage: "Failed to finalise Jobs Report",
  handler: async ({ request, params: { id: reportId } }) => {
    const body = await request.json().catch(() => ({}));
    const parsedOverrides = parseDeductionOverrides({ body });
    if ("error" in parsedOverrides) {
      return NextResponse.json(
        { error: parsedOverrides.error },
        { status: 400 },
      );
    }
    const { overrides } = parsedOverrides;

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

    // The status change and the deductions are written together, so a
    // failure part way leaves the report a draft with no deductions applied.
    // Changing the status first also locks the report row, so a second
    // finalise cannot apply the deductions twice.
    const updatedReport = await prisma.$transaction(async (tx) => {
      const statusChange = await tx.jobsReport.updateMany({
        where: { id: reportId, status: "draft" },
        data: { status: "finalised" },
      });
      if (statusChange.count === 0) return null;

      await applyDeductionsToJobsReport({
        reportId,
        driverId: report.driverId,
        weekEnding: report.weekEnding,
        amountOverrides: overrides.size > 0 ? overrides : undefined,
        tx,
      });

      return tx.jobsReport.findUnique({
        where: { id: reportId },
        include: { ...jobsReportInclude, driver: true },
      });
    }, RCTI_TRANSACTION_OPTIONS);

    if (!updatedReport) {
      return NextResponse.json(
        { error: "Only draft Jobs Reports can be finalised" },
        { status: 409 },
      );
    }

    return NextResponse.json(updatedReport);
  },
});

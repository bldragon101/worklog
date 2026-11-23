import { NextResponse } from "next/server";
import React from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import { JobsReportPdfTemplate } from "@/components/jobs-report/jobs-report-pdf-template";
import { jobsReportInclude } from "@/lib/jobs-report";
import { apiRoute, idParams } from "@/lib/api-route";
import { toJobsReportPdfData } from "@/lib/jobs-report-pdf-data";
import { getPendingDeductionsForDriver } from "@/lib/rcti-deductions";

/**
 * GET /api/jobs-report/[id]/pdf
 * Generate and download a Jobs Report as PDF
 */
export const GET = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error generating Jobs Report PDF",
  responseMessage: "Failed to generate PDF",
  handler: async ({ params: { id: reportId } }) => {
    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      include: { ...jobsReportInclude, driver: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "Company settings not configured. Please configure company details in Settings first.",
        },
        { status: 400 },
      );
    }

    const { logoDataUrl } = await buildCompanyLogoAssets({
      companyLogo: settings.companyLogo,
    });

    const settingsData = {
      companyName: settings.companyName || "",
      companyAbn: settings.companyAbn || "",
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      companyLogo: logoDataUrl,
    };

    const pendingDeductions =
      report.status === "draft"
        ? await getPendingDeductionsForDriver({
            driverId: report.driverId,
            weekEnding: report.weekEnding,
          })
        : [];
    const reportData = toJobsReportPdfData({ report, pendingDeductions });

    const pdfDocument = React.createElement(JobsReportPdfTemplate, {
      report: reportData,
      settings: settingsData,
    }) as React.ReactElement<DocumentProps>;

    const stream = await renderToStream(pdfDocument);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const filename = `${report.reportNumber}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
});

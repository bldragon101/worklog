import { NextResponse } from "next/server";
import React from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import { JobsReportPdfTemplate } from "@/components/jobs-report/jobs-report-pdf-template";
import { apiRoute, idParams } from "@/lib/api-route";

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
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
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

    const reportData = {
      id: report.id,
      reportNumber: report.reportNumber,
      driverName: report.driverName,
      weekEnding: report.weekEnding.toISOString(),
      status: report.status,
      notes: report.notes,
      lines: report.lines.map((line) => ({
        id: line.id,
        jobDate: line.jobDate.toISOString(),
        customer: line.customer,
        truckType: line.truckType,
        startTime: line.startTime,
        finishTime: line.finishTime,
        chargedHours:
          line.chargedHours != null ? line.chargedHours.toNumber() : null,
        travelTimeHours:
          line.travelTimeHours != null ? line.travelTimeHours.toNumber() : null,
        driverCharge:
          line.driverCharge != null ? line.driverCharge.toNumber() : null,
      })),
    };

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

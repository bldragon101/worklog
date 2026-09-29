import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { requireAuthWithPermission } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import { JobsReportPdfTemplate } from "@/components/jobs-report/jobs-report-pdf-template";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/jobs-report/[id]/pdf
 * Generate and download a Jobs Report as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuthWithPermission({
    permission: "manage_jobs_report",
    headers: rateLimitResult.headers,
  });
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

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
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "Company settings not configured. Please configure company details in Settings first.",
        },
        { status: 400, headers: rateLimitResult.headers },
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
          line.travelTimeHours != null
            ? line.travelTimeHours.toNumber()
            : null,
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
        ...rateLimitResult.headers,
      },
    });
  } catch (error) {
    console.error("Error generating Jobs Report PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

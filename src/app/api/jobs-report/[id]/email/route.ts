import { NextResponse } from "next/server";
import React from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import type { CompanySettingsForEmail } from "@/lib/types";
import {
  buildJobsReportEmailSubject,
  buildJobsReportEmailHtml,
} from "@/lib/jobs-report-email-utils";
import {
  JobsReportPdfTemplate,
  type JobsReportPdfData,
} from "@/components/jobs-report/jobs-report-pdf-template";
import { jobsReportInclude } from "@/lib/jobs-report";
import { apiRoute, idParams } from "@/lib/api-route";
import { toJobsReportPdfData } from "@/lib/jobs-report-pdf-data";

async function generateJobsReportPdfBuffer({
  report,
  settings,
}: {
  report: JobsReportPdfData;
  settings: {
    companyName: string;
    companyAbn: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyLogo: string;
  };
}): Promise<Buffer> {
  const pdfDocument = React.createElement(JobsReportPdfTemplate, {
    report,
    settings,
  }) as React.ReactElement<DocumentProps>;

  const stream = await renderToStream(pdfDocument);
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * POST /api/jobs-report/[id]/email
 * Generate Jobs Report PDF and email it to the driver
 */
export const POST = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error sending Jobs Report email",
  responseMessage: "Failed to send Jobs Report email",
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

    if (report.status !== "finalised") {
      return NextResponse.json(
        { error: "Only finalised Jobs Reports can be emailed" },
        { status: 400 },
      );
    }

    const driverEmail = report.driver?.email;
    if (!driverEmail) {
      return NextResponse.json(
        {
          error:
            "Driver does not have an email address configured. Please add an email to the driver record first.",
        },
        { status: 400 },
      );
    }

    const settings =
      (await prisma.companySettings.findFirst()) as CompanySettingsForEmail | null;

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "Company settings not configured. Please configure company details in Settings first.",
        },
        { status: 400 },
      );
    }

    const { logoDataUrl, logoPublicUrl } = await buildCompanyLogoAssets({
      companyLogo: settings.companyLogo,
    });

    const reportData = toJobsReportPdfData({ report });

    const settingsData = {
      companyName: settings.companyName || "",
      companyAbn: settings.companyAbn || "",
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      companyLogo: logoDataUrl,
    };

    const pdfBuffer = await generateJobsReportPdfBuffer({
      report: reportData,
      settings: settingsData,
    });

    const subject = buildJobsReportEmailSubject({
      weekEndingIso: report.weekEnding.toISOString(),
      companyName: settings.companyName,
    });

    const html = buildJobsReportEmailHtml({
      data: {
        companyName: settings.companyName || "",
        companyAbn: settings.companyAbn,
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        companyLogoUrl: logoPublicUrl,
        reportNumber: report.reportNumber,
        driverName: report.driverName,
        weekEnding: report.weekEnding.toISOString(),
        jobCount: report.lines.length,
        status: report.status,
      },
    });

    const replyTo = settings.emailReplyTo || settings.companyEmail || undefined;

    const emailResult = await sendEmail({
      to: driverEmail,
      subject,
      html,
      replyTo,
      fromName: settings.companyName || undefined,
      attachment: {
        data: pdfBuffer,
        filename: `${report.reportNumber}.pdf`,
        contentType: "application/pdf",
      },
    });

    if (!emailResult.success) {
      console.error("Failed to send Jobs Report email:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }

    let sentAt: string | null = null;
    try {
      const updated = await prisma.jobsReport.update({
        where: { id: reportId },
        data: { sentAt: new Date() },
      });
      sentAt = updated.sentAt?.toISOString() ?? null;
    } catch (updateError) {
      console.error(
        `Failed to update sentAt for Jobs Report ${reportId}:`,
        updateError,
      );
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      sentTo: driverEmail,
      sentAt,
    });
  },
});

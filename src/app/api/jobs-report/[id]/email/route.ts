import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import React from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/resend";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import type { CompanySettingsForEmail } from "@/lib/types";
import {
  buildJobsReportEmailSubject,
  buildJobsReportEmailHtml,
} from "@/lib/jobs-report-email-utils";
import { JobsReportPdfTemplate } from "@/components/jobs-report/jobs-report-pdf-template";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

async function generateJobsReportPdfBuffer({
  report,
  settings,
}: {
  report: {
    id: number;
    reportNumber: string;
    driverName: string;
    weekEnding: string;
    status: string;
    notes: string | null;
    lines: Array<{
      id: number;
      jobDate: string;
      customer: string;
      truckType: string;
      startTime: string | null;
      finishTime: string | null;
      chargedHours: number | null;
      travelTimeHours: number | null;
      driverCharge: number | null;
    }>;
  };
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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      authResult.headers.set(key, value);
    });
    return authResult;
  }

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

  try {
    const rawParams = await params;
    const parsed = paramsSchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid report ID",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const reportId = parsed.data.id;

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

    if (report.status !== "finalised") {
      return NextResponse.json(
        { error: "Only finalised Jobs Reports can be emailed" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const driverEmail = report.driver?.email;
    if (!driverEmail) {
      return NextResponse.json(
        {
          error:
            "Driver does not have an email address configured. Please add an email to the driver record first.",
        },
        { status: 400, headers: rateLimitResult.headers },
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
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { logoDataUrl, logoPublicUrl } = await buildCompanyLogoAssets({
      companyLogo: settings.companyLogo,
    });

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
        { status: 500, headers: rateLimitResult.headers },
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

    return NextResponse.json(
      {
        success: true,
        messageId: emailResult.messageId,
        sentTo: driverEmail,
        sentAt,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error sending Jobs Report email:", error);
    return NextResponse.json(
      { error: "Failed to send Jobs Report email" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

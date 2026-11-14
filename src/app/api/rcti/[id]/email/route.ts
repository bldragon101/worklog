import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import type { DocumentProps } from "@react-pdf/renderer";

import { requireRctiAccess } from "@/lib/rcti-access";
import {
  buildRctiEmailHtml,
  buildRctiEmailSubjectLine,
} from "@/lib/email-templates";
import { sendEmail } from "@/lib/resend";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import { prisma } from "@/lib/prisma";
import type { CompanySettingsForEmail } from "@/lib/types";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { apiRoute, idParams } from "@/lib/api-route";
import {
  mapCompanySettingsForPdf,
  mapRctiToPdfData,
  renderPdfToBuffer,
  rctiPdfInclude,
} from "@/lib/rcti-pdf";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";

async function getRctiForEmail({ rctiId }: { rctiId: number }) {
  return prisma.rcti.findUnique({
    where: { id: rctiId },
    include: rctiPdfInclude,
  });
}

/**
 * POST /api/rcti/[id]/email
 * Generate RCTI PDF and email it to the driver
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error sending RCTI email",
  responseMessage: "Failed to send RCTI email",
  handler: async ({ params: { id: rctiId } }) => {
    const rcti = await getRctiForEmail({ rctiId });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    if (rcti.status !== "finalised" && rcti.status !== "paid") {
      return NextResponse.json(
        { error: "Only finalised or paid RCTIs can be emailed" },
        { status: 400 },
      );
    }

    const driverEmail = rcti.driver?.email;
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

    const rctiData = mapRctiToPdfData({ rcti });
    const settingsData = mapCompanySettingsForPdf({ settings, logoDataUrl });
    const pdfBuffer = await renderPdfToBuffer({
      document: createElement(RctiPdfTemplate, {
        rcti: rctiData,
        settings: settingsData,
      }) as ReactElement<DocumentProps>,
    });

    const subject = buildRctiEmailSubjectLine({
      weekEnding: rcti.weekEnding.toISOString(),
      companyName: settings.companyName,
    });

    const totalFormatted = toNumber(rcti.total).toFixed(2);

    const html = buildRctiEmailHtml({
      data: {
        companyName: settings.companyName,
        companyAbn: settings.companyAbn,
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        companyLogoUrl: logoPublicUrl,
        invoiceNumber: rcti.invoiceNumber,
        driverName: rcti.driverName,
        weekEnding: rcti.weekEnding.toISOString(),
        total: totalFormatted,
        status: rcti.status,
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
        filename: `${rcti.invoiceNumber}.pdf`,
        contentType: "application/pdf",
      },
    });

    if (!emailResult.success) {
      console.error("Failed to send RCTI email:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }

    let sentAt: string | null = null;
    try {
      const updated = await prisma.rcti.update({
        where: { id: rctiId },
        data: { sentAt: new Date() },
      });
      sentAt = updated.sentAt?.toISOString() ?? null;
    } catch (updateError) {
      console.error(`Failed to update sentAt for RCTI ${rctiId}:`, updateError);
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      sentTo: driverEmail,
      sentAt,
    });
  },
});

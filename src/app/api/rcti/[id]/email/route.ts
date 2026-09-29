import { NextResponse } from "next/server";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";

import React from "react";

import { requireRctiAccess } from "@/lib/rcti-access";
import {
  buildRctiEmailHtml,
  buildRctiEmailSubjectLine,
} from "@/lib/email-templates";
import { sendEmail } from "@/lib/resend";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import { prisma } from "@/lib/prisma";
import type { CompanySettingsForEmail, GstMode, GstStatus } from "@/lib/types";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { apiRoute, idParams } from "@/lib/api-route";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";

async function getRctiForEmail({ rctiId }: { rctiId: number }) {
  return prisma.rcti.findUnique({
    where: { id: rctiId },
    include: {
      lines: {
        orderBy: { jobDate: "asc" },
      },
      driver: true,
      deductionApplications: {
        include: {
          deduction: {
            select: {
              id: true,
              type: true,
              description: true,
              frequency: true,
              totalAmount: true,
              amountPaid: true,
              amountRemaining: true,
            },
          },
        },
      },
    },
  });
}

function mapRctiToPdfData({
  rcti,
}: {
  rcti: Awaited<ReturnType<typeof getRctiForEmail>> extends infer T
    ? Exclude<T, null>
    : never;
}) {
  return {
    id: rcti.id,
    invoiceNumber: rcti.invoiceNumber,
    driverName: rcti.driverName,
    businessName: rcti.businessName,
    driverAddress: rcti.driverAddress,
    driverAbn: rcti.driverAbn,
    weekEnding: rcti.weekEnding.toISOString(),
    gstStatus: rcti.gstStatus as GstStatus,
    gstMode: rcti.gstMode as GstMode,
    bankAccountName: rcti.bankAccountName,
    bankBsb: rcti.bankBsb,
    bankAccountNumber: rcti.bankAccountNumber,
    subtotal: toNumber(rcti.subtotal),
    gst: toNumber(rcti.gst),
    total: toNumber(rcti.total),
    status: rcti.status as string,
    notes: rcti.notes,
    revertedToDraftAt: rcti.revertedToDraftAt
      ? rcti.revertedToDraftAt.toISOString()
      : null,
    revertedToDraftReason: rcti.revertedToDraftReason,
    lines: rcti.lines.map((line) => ({
      id: line.id,
      jobDate: line.jobDate.toISOString(),
      customer: line.customer,
      truckType: line.truckType,
      description: line.description,
      chargedHours: toNumber(line.chargedHours),
      travelTimeHours:
        line.travelTimeHours === null ? null : toNumber(line.travelTimeHours),
      driverCharge:
        line.driverCharge === null ? null : toNumber(line.driverCharge),
      ratePerHour: toNumber(line.ratePerHour),
      amountExGst: toNumber(line.amountExGst),
      gstAmount: toNumber(line.gstAmount),
      amountIncGst: toNumber(line.amountIncGst),
    })),
    deductionApplications: rcti.deductionApplications?.map((app) => ({
      id: app.id,
      deductionId: app.deductionId,
      amount: toNumber(app.amount),
      appliedAt: app.appliedAt.toISOString(),
      deduction: {
        id: app.deduction.id,
        type: app.deduction.type,
        description: app.deduction.description,
        frequency: app.deduction.frequency,
        totalAmount: toNumber(app.deduction.totalAmount),
        amountPaid: toNumber(app.deduction.amountPaid),
        amountRemaining: toNumber(app.deduction.amountRemaining),
      },
    })),
  };
}

function mapSettingsForPdf({
  settings,
  logoDataUrl,
}: {
  settings: CompanySettingsForEmail;
  logoDataUrl: string;
}) {
  return {
    companyName: settings.companyName || "",
    companyAbn: settings.companyAbn || "",
    companyAddress: settings.companyAddress || "",
    companyPhone: settings.companyPhone || "",
    companyEmail: settings.companyEmail || "",
    companyLogo: logoDataUrl,
  };
}

async function generateRctiPdfBuffer({
  rctiData,
  settingsData,
}: {
  rctiData: ReturnType<typeof mapRctiToPdfData>;
  settingsData: ReturnType<typeof mapSettingsForPdf>;
}): Promise<Buffer> {
  const pdfDocument = React.createElement(RctiPdfTemplate, {
    rcti: rctiData,
    settings: settingsData,
  }) as React.ReactElement<DocumentProps>;

  const stream = await renderToStream(pdfDocument);
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
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
    const settingsData = mapSettingsForPdf({ settings, logoDataUrl });
    const pdfBuffer = await generateRctiPdfBuffer({ rctiData, settingsData });

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

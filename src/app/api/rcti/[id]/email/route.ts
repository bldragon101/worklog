import { NextRequest, NextResponse } from "next/server";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";

import React from "react";

import { requireAuth } from "@/lib/auth";
import {
  buildRctiEmailHtml,
  buildRctiEmailSubjectLine,
} from "@/lib/email-templates";
import { sendEmail } from "@/lib/resend";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import type { GstMode, GstStatus } from "@/lib/types";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

type CompanySettingsForEmail = {
  companyName: string;
  companyAbn: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;
  emailReplyTo: string | null;
};

type LogoAssets = {
  logoDataUrl: string;
  logoPublicUrl: string | null;
};

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

function getProtocolFromHost({ host }: { host: string }): "http" | "https" {
  if (host.startsWith("localhost")) {
    return "http";
  }

  return "https";
}

async function buildLogoAssets({
  companyLogo,
  host,
}: {
  companyLogo: string | null;
  host: string;
}): Promise<LogoAssets> {
  if (!companyLogo) {
    return {
      logoDataUrl: "",
      logoPublicUrl: null,
    };
  }

  const isAbsoluteUrl =
    companyLogo.startsWith("http://") || companyLogo.startsWith("https://");
  const protocol = getProtocolFromHost({ host });
  const logoPublicUrl = isAbsoluteUrl
    ? companyLogo
    : `${protocol}://${host}${companyLogo}`;

  try {
    const logoResponse = await fetch(logoPublicUrl);
    if (!logoResponse.ok) {
      console.error("Error fetching logo file:", logoResponse.statusText);
      return {
        logoDataUrl: "",
        logoPublicUrl,
      };
    }

    const contentType = logoResponse.headers.get("content-type") || "image/png";
    const logoArrayBuffer = await logoResponse.arrayBuffer();
    const logoBase64 = Buffer.from(logoArrayBuffer).toString("base64");

    return {
      logoDataUrl: `data:${contentType};base64,${logoBase64}`,
      logoPublicUrl,
    };
  } catch (error) {
    console.error("Error fetching logo file:", error);
    return {
      logoDataUrl: "",
      logoPublicUrl,
    };
  }
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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const rawParams = await params;
    const parsed = paramsSchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid RCTI ID",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const rctiId = parsed.data.id;

    const rcti = await getRctiForEmail({ rctiId });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status !== "finalised" && rcti.status !== "paid") {
      return NextResponse.json(
        { error: "Only finalised or paid RCTIs can be emailed" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const driverEmail = rcti.driver?.email;
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

    const host = request.headers.get("host") || "localhost:3000";
    const { logoDataUrl, logoPublicUrl } = await buildLogoAssets({
      companyLogo: settings.companyLogo,
      host,
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
        { status: 500, headers: rateLimitResult.headers },
      );
    }

    return NextResponse.json(
      {
        success: true,
        messageId: emailResult.messageId,
        sentTo: driverEmail,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error sending RCTI email:", error);
    return NextResponse.json(
      { error: "Failed to send RCTI email" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

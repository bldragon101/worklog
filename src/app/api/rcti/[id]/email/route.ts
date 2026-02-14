import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";
import React from "react";
import { readFile } from "fs/promises";
import path from "path";
import type { GstStatus, GstMode } from "@/lib/types";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { sendEmail } from "@/lib/mailgun";
import {
  buildRctiEmailSubject,
  buildRctiEmailHtml,
} from "@/lib/email-templates";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

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
    const { id } = await params;
    const rctiId = parseInt(id, 10);

    if (isNaN(rctiId)) {
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Fetch RCTI with lines, driver, and deduction applications
    const rcti = await prisma.rcti.findUnique({
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

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    // Only allow emailing finalised or paid RCTIs
    if (rcti.status !== "finalised" && rcti.status !== "paid") {
      return NextResponse.json(
        { error: "Only finalised or paid RCTIs can be emailed" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Validate the driver has an email address
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

    // Fetch company settings
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

    // Convert logo to base64 if it exists (for PDF)
    let logoDataUrl = "";
    let logoPublicUrl: string | null = null;
    if (settings.companyLogo && settings.companyLogo.startsWith("/uploads/")) {
      try {
        const logoPath = path.join(
          process.cwd(),
          "public",
          settings.companyLogo,
        );
        const logoBuffer = await readFile(logoPath);
        const logoBase64 = logoBuffer.toString("base64");

        const ext = path.extname(settings.companyLogo).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
        };
        const mimeType = mimeTypes[ext] || "image/png";

        logoDataUrl = `data:${mimeType};base64,${logoBase64}`;

        // Build a public URL for the email template (email clients cannot render base64)
        const host = request.headers.get("host") || "localhost:3000";
        const protocol = host.startsWith("localhost") ? "http" : "https";
        logoPublicUrl = `${protocol}://${host}${settings.companyLogo}`;
      } catch (error) {
        console.error("Error reading logo file:", error);
      }
    }

    // Prepare settings data for PDF generation
    const settingsData = {
      companyName: settings.companyName || "",
      companyAbn: settings.companyAbn || "",
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      companyLogo: logoDataUrl,
    };

    // Transform Prisma data for PDF template
    const rctiData = {
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

    // Generate PDF
    const pdfDocument = React.createElement(RctiPdfTemplate, {
      rcti: rctiData,
      settings: settingsData,
    }) as React.ReactElement<DocumentProps>;

    const stream = await renderToStream(pdfDocument);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    const pdfFilename = `${rcti.invoiceNumber}.pdf`;

    // Build the email
    const subject = buildRctiEmailSubject({
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

    // Determine reply-to address
    const replyTo = settings.emailReplyTo || settings.companyEmail || undefined;

    // Send the email
    const emailResult = await sendEmail({
      to: driverEmail,
      subject,
      html,
      replyTo,
      attachment: {
        data: pdfBuffer,
        filename: pdfFilename,
        contentType: "application/pdf",
      },
    });

    if (!emailResult.success) {
      console.error("Failed to send RCTI email:", emailResult.error);
      return NextResponse.json(
        { error: emailResult.error || "Failed to send email" },
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

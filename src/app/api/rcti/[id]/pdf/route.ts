import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";
import React from "react";

import type { GstStatus, GstMode, RctiStatus } from "@/lib/types";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { getPendingDeductionsForDriver } from "@/lib/rcti-deductions";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti/[id]/pdf
 * Generate and download RCTI as PDF
 */
export async function GET(
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

    // Fetch RCTI with lines and deduction applications
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

    // Fetch company settings
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "RCTI settings not configured. Please configure company details in RCTI settings.",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Convert logo URL to base64 if it exists
    let logoDataUrl = "";
    if (settings.companyLogo) {
      try {
        const logoResponse = await fetch(settings.companyLogo);
        if (logoResponse.ok) {
          const contentType =
            logoResponse.headers.get("content-type") || "image/png";
          const logoArrayBuffer = await logoResponse.arrayBuffer();
          const logoBase64 = Buffer.from(logoArrayBuffer).toString("base64");
          logoDataUrl = `data:${contentType};base64,${logoBase64}`;
        } else {
          console.error("Error fetching logo file:", logoResponse.statusText);
        }
      } catch (error) {
        console.error("Error fetching logo file:", error);
        // Continue without logo if there's an error
      }
    }

    // Prepare settings data
    const settingsData = {
      companyName: settings.companyName || "",
      companyAbn: settings.companyAbn || "",
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      companyLogo: logoDataUrl,
    };

    // Transform Prisma data to match PDF template types
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
      status: rcti.status as RctiStatus,
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

    // For draft RCTIs, fetch and include pending deductions
    if (rcti.status === "draft") {
      try {
        const pendingDeductions = await getPendingDeductionsForDriver({
          driverId: rcti.driverId,
          weekEnding: rcti.weekEnding,
        });

        // Convert pending deductions to deductionApplications format for PDF
        if (pendingDeductions.length > 0) {
          rctiData.deductionApplications = pendingDeductions.map((pending) => ({
            id: pending.id,
            deductionId: pending.id,
            amount: pending.amountToApply,
            appliedAt: new Date().toISOString(),
            deduction: {
              id: pending.id,
              type: pending.type,
              description: pending.description,
              frequency: pending.frequency,
              totalAmount: 0, // Not available for pending
              amountPaid: 0, // Not available for pending
              amountRemaining: pending.amountRemaining,
            },
          }));
        }
      } catch (error) {
        console.error(
          "Error fetching pending deductions for draft PDF:",
          error,
        );
        // Continue without pending deductions if there's an error
      }
    }

    // Generate PDF using React.createElement
    const pdfDocument = React.createElement(RctiPdfTemplate, {
      rcti: rctiData,
      settings: settingsData,
    }) as React.ReactElement<DocumentProps>;

    const stream = await renderToStream(pdfDocument);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Return PDF as response
    const filename = `${rcti.invoiceNumber}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...rateLimitResult.headers,
      },
    });
  } catch (error) {
    console.error("Error generating RCTI PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

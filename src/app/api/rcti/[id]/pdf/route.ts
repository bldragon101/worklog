import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { buildCompanyLogoAssets } from "@/lib/company-logo";
import type { DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";
import {
  mapCompanySettingsForPdf,
  mapRctiToPdfData,
  renderPdfToBuffer,
  rctiPdfInclude,
} from "@/lib/rcti-pdf";
import { getPendingDeductionsForDriver } from "@/lib/rcti-deductions";
import { apiRoute, idParams } from "@/lib/api-route";

/**
 * GET /api/rcti/[id]/pdf
 * Generate and download RCTI as PDF
 */
export const GET = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid RCTI ID" }),
  errorMessage: "Error generating RCTI PDF",
  responseMessage: "Failed to generate PDF",
  handler: async ({ params: { id: rctiId } }) => {
    // Fetch RCTI with lines and deduction applications
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: rctiPdfInclude,
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    // Fetch company settings
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "RCTI settings not configured. Please configure company details in RCTI settings.",
        },
        { status: 400 },
      );
    }

    const { logoDataUrl } = await buildCompanyLogoAssets({
      companyLogo: settings.companyLogo,
    });

    const settingsData = mapCompanySettingsForPdf({ settings, logoDataUrl });
    const rctiData = mapRctiToPdfData({ rcti });

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

    const buffer = await renderPdfToBuffer({
      document: createElement(RctiPdfTemplate, {
        rcti: rctiData,
        settings: settingsData,
      }) as ReactElement<DocumentProps>,
    });

    // Return PDF as response
    const filename = `${rcti.invoiceNumber}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
});

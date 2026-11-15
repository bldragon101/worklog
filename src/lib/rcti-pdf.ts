import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { Prisma } from "@/generated/prisma/client";

import type { CompanySettingsForEmail, GstMode, GstStatus } from "@/lib/types";
import { toNumber } from "@/lib/utils/rcti-calculations";

/** Prisma include for everything an RCTI PDF shows */
export const rctiPdfInclude = {
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
} satisfies Prisma.RctiInclude;

export type RctiForPdf = Prisma.RctiGetPayload<{
  include: typeof rctiPdfInclude;
}>;

export type RctiPdfData = ReturnType<typeof mapRctiToPdfData>;

export type CompanySettingsPdfData = ReturnType<
  typeof mapCompanySettingsForPdf
>;

/** Converts an RCTI loaded with `rctiPdfInclude` into the PDF template's shape */
export function mapRctiToPdfData({ rcti }: { rcti: RctiForPdf }) {
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
    paidAt: rcti.paidAt ? rcti.paidAt.toISOString() : null,
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

/** Company details shown in the header and footer of RCTI PDFs */
export function mapCompanySettingsForPdf({
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

/** Renders a react-pdf document to a Buffer */
export async function renderPdfToBuffer({
  document,
}: {
  document: ReactElement<DocumentProps>;
}): Promise<Buffer> {
  const stream = await renderToStream(document);
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

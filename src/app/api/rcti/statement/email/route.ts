import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import type { DocumentProps } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { ApiError, apiRoute } from "@/lib/api-route";
import { rctiStatementSchema } from "@/lib/validation";
import { sendEmail } from "@/lib/resend";
import { buildRctiStatementEmailHtml } from "@/lib/email-templates";
import { renderPdfToBuffer } from "@/lib/rcti-pdf";
import {
  buildRctiStatementEmailSubject,
  buildRctiStatementFilename,
} from "@/lib/rcti-statement";
import {
  loadRctiStatement,
  renderRctiStatementPdf,
} from "@/lib/rcti-statement-server";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";

/**
 * POST /api/rcti/statement/email
 * Email a driver their statement and/or copies of the selected RCTIs, as PDF
 * attachments on a single email.
 * Body: { driverId, rctiIds, includeStatement?: boolean, includeRctis?: boolean }
 * When the RCTIs are attached, their sentAt is updated.
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  validationMessage: "Invalid statement email request",
  errorMessage: "Error sending RCTI statement email",
  responseMessage: "Failed to send statement email",
  handler: async ({ request }) => {
    const body = await request.json().catch(() => null);
    const { driverId, rctiIds, includeStatement, includeRctis } =
      rctiStatementSchema.parse(body);

    const data = await loadRctiStatement({ driverId, rctiIds });

    if (!data.driverEmail) {
      throw new ApiError({
        status: 400,
        message:
          "Driver does not have an email address configured. Please add an email to the driver record first.",
      });
    }

    const [statementPdf, rctiPdfs] = await Promise.all([
      includeStatement
        ? renderRctiStatementPdf({
            data,
            includeStatement: true,
            includeRctis: false,
          })
        : null,
      includeRctis
        ? Promise.all(
            data.rctiData.map((rcti) =>
              renderPdfToBuffer({
                document: createElement(RctiPdfTemplate, {
                  rcti,
                  settings: data.settingsData,
                }) as ReactElement<DocumentProps>,
              }),
            ),
          )
        : [],
    ]);

    const attachments = [
      ...(statementPdf
        ? [
            {
              data: statementPdf,
              filename: buildRctiStatementFilename({
                driverName: data.driver.driverName,
                periodStart: data.statement.periodStart,
                periodEnd: data.statement.periodEnd,
                includeStatement: true,
              }),
              contentType: "application/pdf",
            },
          ]
        : []),
      ...rctiPdfs.map((pdf, index) => ({
        data: pdf,
        filename: `${data.rctiData[index].invoiceNumber}.pdf`,
        contentType: "application/pdf",
      })),
    ];

    const subject = buildRctiStatementEmailSubject({
      periodStart: data.statement.periodStart,
      periodEnd: data.statement.periodEnd,
      companyName: data.settings.companyName,
      includeStatement,
    });

    const html = buildRctiStatementEmailHtml({
      data: {
        companyName: data.settings.companyName,
        companyAbn: data.settings.companyAbn,
        companyAddress: data.settings.companyAddress,
        companyPhone: data.settings.companyPhone,
        companyEmail: data.settings.companyEmail,
        companyLogoUrl: data.logoPublicUrl,
        driverName: data.driver.driverName,
        statement: data.statement,
        includeStatement,
        includeRctis,
      },
    });

    const emailResult = await sendEmail({
      to: data.driverEmail,
      subject,
      html,
      replyTo:
        data.settings.emailReplyTo || data.settings.companyEmail || undefined,
      fromName: data.settings.companyName || undefined,
      attachments,
    });

    if (!emailResult.success) {
      console.error("Failed to send RCTI statement email:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }

    let sentAt: string | null = null;
    if (includeRctis) {
      const now = new Date();
      try {
        await prisma.rcti.updateMany({
          where: { id: { in: data.rctis.map(({ id }) => id) } },
          data: { sentAt: now },
        });
        sentAt = now.toISOString();
      } catch (updateError) {
        console.error(
          "Failed to update sentAt for RCTIs sent with statement:",
          updateError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      sentTo: data.driverEmail,
      sentAt,
      sentRctiIds: includeRctis ? data.rctis.map(({ id }) => id) : [],
    });
  },
});

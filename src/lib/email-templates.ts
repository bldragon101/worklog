import {
  buildRctiEmailSubject as buildCanonicalRctiEmailSubject,
  formatRctiWeekEndingShort,
} from "@/lib/rcti-email-utils";
import {
  formatStatementDate,
  formatStatementPeriod,
  type RctiStatement,
} from "@/lib/rcti-statement";
import { formatCurrency } from "@/lib/utils/currency";

interface RctiEmailTemplateData {
  companyName: string;
  companyAbn: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogoUrl: string | null;
  invoiceNumber: string;
  driverName: string;
  weekEnding: string;
  total: string;
  status: string;
}

function escapeHtml({ text }: { text: string }): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface CompanyBrandingData {
  companyName: string;
  companyAbn: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogoUrl: string | null;
}

/** Logo and contact lines shared by the RCTI emails */
function buildCompanyBrandingHtml({
  company,
}: {
  company: CompanyBrandingData;
}): { logoHtml: string; companyDetailsHtml: string } {
  const logoHtml = company.companyLogoUrl
    ? `<img src="${escapeHtml({ text: company.companyLogoUrl })}" alt="${escapeHtml({ text: company.companyName })}" style="max-height:60px;max-width:200px;margin-bottom:12px;" /><br />`
    : "";

  const companyDetailsLines: string[] = [];
  if (company.companyAbn) {
    companyDetailsLines.push(`ABN: ${escapeHtml({ text: company.companyAbn })}`);
  }
  if (company.companyAddress) {
    companyDetailsLines.push(escapeHtml({ text: company.companyAddress }));
  }
  if (company.companyPhone) {
    companyDetailsLines.push(escapeHtml({ text: company.companyPhone }));
  }
  if (company.companyEmail) {
    companyDetailsLines.push(escapeHtml({ text: company.companyEmail }));
  }

  const companyDetailsHtml =
    companyDetailsLines.length > 0
      ? `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${companyDetailsLines.join("<br />")}</p>`
      : "";

  return { logoHtml, companyDetailsHtml };
}

export function buildRctiEmailSubjectLine({
  weekEnding,
  companyName,
}: {
  weekEnding: string;
  companyName: string;
}): string {
  return buildCanonicalRctiEmailSubject({
    weekEndingIso: weekEnding,
    companyName,
  });
}

export function buildRctiEmailSubject({
  weekEnding,
  companyName,
}: {
  weekEnding: string;
  companyName: string;
}): string {
  return buildCanonicalRctiEmailSubject({
    weekEndingIso: weekEnding,
    companyName,
  });
}

export function buildRctiEmailHtml({
  data,
}: {
  data: RctiEmailTemplateData;
}): string {
  const weekEndingFormatted = formatRctiWeekEndingShort({
    isoString: data.weekEnding,
  });

  const { logoHtml, companyDetailsHtml } = buildCompanyBrandingHtml({
    company: data,
  });

  const statusLabel =
    data.status === "finalised"
      ? "Finalised"
      : data.status === "paid"
        ? "Paid"
        : data.status;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RCTI - ${escapeHtml({ text: data.invoiceNumber })}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#ffffff;padding:24px 32px;text-align:center;border-bottom:2px solid #e5e7eb;">
              ${logoHtml}
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e3a5f;">
                ${escapeHtml({ text: data.companyName })}
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">
                Hi ${escapeHtml({ text: data.driverName })},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Please find attached your Recipient Created Tax Invoice (RCTI) for the week ending <strong>${weekEndingFormatted}</strong>.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">Invoice Number</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding-bottom:8px;text-align:right;">${escapeHtml({ text: data.invoiceNumber })}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">Week Ending</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding-bottom:8px;text-align:right;">${weekEndingFormatted}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">Status</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding-bottom:8px;text-align:right;">${escapeHtml({ text: statusLabel })}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:12px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-size:15px;color:#111827;font-weight:700;">Total</td>
                              <td style="font-size:15px;color:#1e3a5f;font-weight:700;text-align:right;">$${escapeHtml({ text: data.total })}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                The full RCTI is attached to this email as a PDF.
              </p>
              <p style="margin:0;font-size:14px;color:#6b7280;">
                If you have any queries regarding this RCTI, please reply to this email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">
                ${escapeHtml({ text: data.companyName })}
              </p>
              ${companyDetailsHtml}
              <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">
                This is an automated email. Please do not reply directly unless you have a query regarding this RCTI.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface RctiStatementEmailTemplateData extends CompanyBrandingData {
  driverName: string;
  statement: RctiStatement;
  includeStatement: boolean;
  includeRctis: boolean;
}

function formatStatusLabel({ status }: { status: string }): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Email that carries a driver's RCTI statement and/or copies of the RCTIs it lists */
export function buildRctiStatementEmailHtml({
  data,
}: {
  data: RctiStatementEmailTemplateData;
}): string {
  const { logoHtml, companyDetailsHtml } = buildCompanyBrandingHtml({
    company: data,
  });
  const { rows, totals } = data.statement;
  const period = formatStatementPeriod({
    periodStart: data.statement.periodStart,
    periodEnd: data.statement.periodEnd,
  });
  const periodText = period ? ` for ${escapeHtml({ text: period })}` : "";
  const rctiWord = rows.length === 1 ? "RCTI" : "RCTIs";

  const intro = data.includeStatement
    ? data.includeRctis
      ? `Please find attached your RCTI statement${periodText}, along with a copy of each RCTI it includes.`
      : `Please find attached your RCTI statement${periodText}.`
    : `Please find attached a copy of the following Recipient Created Tax ${rows.length === 1 ? "Invoice" : "Invoices"} (${rctiWord}).`;

  const rowsHtml = rows
    .map(
      (row) => `<tr>
                        <td style="font-size:13px;color:#111827;padding:8px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml({ text: row.invoiceNumber })}</td>
                        <td style="font-size:13px;color:#374151;padding:8px 0;border-bottom:1px solid #e5e7eb;">${formatStatementDate({ isoString: row.weekEnding })}</td>
                        <td style="font-size:13px;color:#374151;padding:8px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml({ text: formatStatusLabel({ status: row.status }) })}</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency({ amount: row.amountPayable })}</td>
                      </tr>`,
    )
    .join("\n");

  const attachmentNote = data.includeStatement
    ? data.includeRctis
      ? "The statement and each RCTI are attached to this email as PDFs."
      : "The full statement is attached to this email as a PDF."
    : `The ${rctiWord} ${rows.length === 1 ? "is" : "are"} attached to this email as ${rows.length === 1 ? "a PDF" : "PDFs"}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RCTI Statement - ${escapeHtml({ text: data.driverName })}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#ffffff;padding:24px 32px;text-align:center;border-bottom:2px solid #e5e7eb;">
              ${logoHtml}
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e3a5f;">
                ${escapeHtml({ text: data.companyName })}
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">
                Hi ${escapeHtml({ text: data.driverName })},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                ${intro}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <th style="font-size:12px;color:#6b7280;font-weight:600;text-align:left;padding-bottom:8px;border-bottom:1px solid #d1d5db;">Invoice</th>
                        <th style="font-size:12px;color:#6b7280;font-weight:600;text-align:left;padding-bottom:8px;border-bottom:1px solid #d1d5db;">Week Ending</th>
                        <th style="font-size:12px;color:#6b7280;font-weight:600;text-align:left;padding-bottom:8px;border-bottom:1px solid #d1d5db;">Status</th>
                        <th style="font-size:12px;color:#6b7280;font-weight:600;text-align:right;padding-bottom:8px;border-bottom:1px solid #d1d5db;">Amount Payable</th>
                      </tr>
                      ${rowsHtml}
                      <tr>
                        <td colspan="3" style="font-size:13px;color:#6b7280;padding-top:12px;">Paid</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding-top:12px;text-align:right;">${formatCurrency({ amount: totals.paid })}</td>
                      </tr>
                      <tr>
                        <td colspan="3" style="font-size:15px;color:#111827;font-weight:700;padding-top:8px;">Balance Outstanding</td>
                        <td style="font-size:15px;color:#1e3a5f;font-weight:700;padding-top:8px;text-align:right;">${formatCurrency({ amount: totals.outstanding })}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                ${attachmentNote}
              </p>
              <p style="margin:0;font-size:14px;color:#6b7280;">
                If you have any queries, please reply to this email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">
                ${escapeHtml({ text: data.companyName })}
              </p>
              ${companyDetailsHtml}
              <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">
                This is an automated email. Please do not reply directly unless you have a query.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

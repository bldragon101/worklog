import {
  buildRctiEmailSubject as buildCanonicalRctiEmailSubject,
  formatRctiWeekEndingShort,
} from "@/lib/rcti-email-utils";

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

  const logoHtml = data.companyLogoUrl
    ? `<img src="${escapeHtml({ text: data.companyLogoUrl })}" alt="${escapeHtml({ text: data.companyName })}" style="max-height:60px;max-width:200px;margin-bottom:12px;" /><br />`
    : "";

  const companyDetailsLines: string[] = [];
  if (data.companyAbn) {
    companyDetailsLines.push(`ABN: ${escapeHtml({ text: data.companyAbn })}`);
  }
  if (data.companyAddress) {
    companyDetailsLines.push(escapeHtml({ text: data.companyAddress }));
  }
  if (data.companyPhone) {
    companyDetailsLines.push(escapeHtml({ text: data.companyPhone }));
  }
  if (data.companyEmail) {
    companyDetailsLines.push(escapeHtml({ text: data.companyEmail }));
  }

  const companyDetailsHtml =
    companyDetailsLines.length > 0
      ? `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${companyDetailsLines.join("<br />")}</p>`
      : "";

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

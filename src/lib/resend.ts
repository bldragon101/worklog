import { Resend } from "resend";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
  attachment?: {
    data: Buffer;
    filename: string;
    contentType: string;
  };
}

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  fromName,
  attachment,
}: SendEmailParams): Promise<SendEmailResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.RESEND_DOMAIN;

  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  if (!domain) {
    return { success: false, error: "RESEND_DOMAIN is not configured" };
  }

  const displayName = fromName?.trim() || "RCTI";
  const fromAddress = `${displayName} <rcti@${domain}>`;

  const resend = new Resend(apiKey);

  try {
    const attachments = attachment
      ? [
          {
            content: attachment.data,
            filename: attachment.filename,
            content_type: attachment.contentType,
          },
        ]
      : undefined;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      replyTo: replyTo || undefined,
      attachments,
    });

    if (error) {
      console.error("Resend API error:", error);
      return {
        success: false,
        error: `Resend API error: ${error.message}`,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error("Error sending email via Resend:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

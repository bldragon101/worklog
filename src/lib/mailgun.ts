interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachment?: {
    data: Buffer;
    filename: string;
    contentType: string;
  };
}

interface MailgunResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  attachment,
}: SendEmailParams): Promise<MailgunResponse> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;

  if (!apiKey) {
    return { success: false, error: "MAILGUN_API_KEY is not configured" };
  }

  if (!domain) {
    return { success: false, error: "MAILGUN_DOMAIN is not configured" };
  }

  const fromAddress = `RCTI <rcti@${domain}>`;
  const url = `https://api.mailgun.net/v3/${domain}/messages`;

  const formData = new FormData();
  formData.append("from", fromAddress);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);

  if (replyTo) {
    formData.append("h:Reply-To", replyTo);
  }

  if (attachment) {
    const uint8 = new Uint8Array(attachment.data);
    const blob = new Blob([uint8], { type: attachment.contentType });
    formData.append("attachment", blob, attachment.filename);
  }

  const credentials = Buffer.from(`api:${apiKey}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Mailgun API error:", response.status, errorBody);
      return {
        success: false,
        error: `Mailgun API returned ${response.status}: ${errorBody}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
    };
  } catch (error) {
    console.error("Error sending email via Mailgun:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

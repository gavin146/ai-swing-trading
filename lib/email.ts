import type { AlertStatus } from "./database.types";
import { buildBrandedEmail, escapeHtml } from "./email-branding";

type SendEmailArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendEmailResult = {
  mode: "resend" | "unconfigured";
  id: string | null;
  status: AlertStatus;
  from: string;
  error?: string;
};

export function getEmailDeliveryStatus() {
  const from = process.env.ALERT_FROM_EMAIL ?? "";
  const resendApiKey = process.env.RESEND_API_KEY ?? "";

  return {
    configured: Boolean(from && resendApiKey),
    from,
    provider: "resend" as const,
    reason: !resendApiKey
      ? "RESEND_API_KEY is missing."
      : !from
        ? "ALERT_FROM_EMAIL is missing."
        : null,
  };
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const status = getEmailDeliveryStatus();
  const from = status.from;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!status.configured || !resendApiKey) {
    return {
      mode: "unconfigured",
      id: null,
      status: "failed",
      from,
      error: status.reason ?? "Email delivery is not configured.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });
  const payload = (await response.json()) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!response.ok) {
    return {
      mode: "resend",
      id: payload.id ?? null,
      status: "failed",
      from,
      error: payload.message ?? payload.name ?? "Email request failed",
    };
  }

  return {
    mode: "resend",
    id: payload.id ?? null,
    status: "queued",
    from,
  };
}

export async function sendAdminFailureAlert(args: {
  source: string;
  message: string;
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  const recipients = (process.env.ADMIN_ALERT_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  if (!recipients.length) {
    return [];
  }

  const details = [
    `Source: ${args.source}`,
    `Message: ${args.message}`,
    args.error ? `Error: ${args.error}` : null,
    args.metadata ? `Metadata: ${JSON.stringify(args.metadata, null, 2)}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return Promise.all(
    recipients.map((to) => {
      const metadata = args.metadata ? JSON.stringify(args.metadata, null, 2) : "";

      return sendEmail({
        to,
        subject: `SwingFi production alert: ${args.source}`,
        text: details,
        html: buildBrandedEmail({
          eyebrow: "Operations alert",
          preheader: `SwingFi production alert: ${args.source}`,
          title: "Production alert",
          bodyHtml: `
            <p style="margin:0 0 12px;color:#071418;font-size:15px;font-weight:900;">${escapeHtml(args.message)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:16px;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e6ece8;color:#3f4d47;font-size:12px;font-weight:900;text-transform:uppercase;">Source</td>
                <td style="padding:10px 0;border-bottom:1px solid #e6ece8;color:#071418;font-size:13px;font-weight:800;text-align:right;">${escapeHtml(args.source)}</td>
              </tr>
              ${
                args.error
                  ? `<tr>
                      <td style="padding:10px 0;border-bottom:1px solid #e6ece8;color:#3f4d47;font-size:12px;font-weight:900;text-transform:uppercase;">Error</td>
                      <td style="padding:10px 0;border-bottom:1px solid #e6ece8;color:#b4533f;font-size:13px;font-weight:800;text-align:right;">${escapeHtml(args.error)}</td>
                    </tr>`
                  : ""
              }
            </table>
            ${
              metadata
                ? `<pre style="margin:18px 0 0;white-space:pre-wrap;background:#f5f7fb;border:1px solid #d8e0ea;border-radius:14px;padding:14px;color:#33423d;font-size:12px;line-height:1.5;">${escapeHtml(metadata)}</pre>`
                : ""
            }`,
          footerNote:
            "This operational email was sent to configured SwingFi admins because production monitoring detected an issue.",
        }),
      });
    }),
  );
}

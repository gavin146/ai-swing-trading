import type { AlertStatus } from "./database.types";

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
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `SwingFi production alert: ${args.source}`,
        text: details,
        html: `<div style="font-family:Inter,Arial,sans-serif;color:#071418;line-height:1.5">
          <h1 style="font-size:20px;margin:0 0 12px">SwingFi production alert</h1>
          <p><strong>Source:</strong> ${args.source}</p>
          <p><strong>Message:</strong> ${args.message}</p>
          ${args.error ? `<p><strong>Error:</strong> ${args.error}</p>` : ""}
          ${
            args.metadata
              ? `<pre style="white-space:pre-wrap;background:#f4f7f4;border:1px solid #dfe7df;border-radius:8px;padding:12px">${JSON.stringify(
                  args.metadata,
                  null,
                  2,
                )}</pre>`
              : ""
          }
        </div>`,
      }),
    ),
  );
}

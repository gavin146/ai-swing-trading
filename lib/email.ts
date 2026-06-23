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

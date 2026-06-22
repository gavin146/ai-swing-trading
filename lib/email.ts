type SendEmailArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(args: SendEmailArgs) {
  const from = process.env.ALERT_FROM_EMAIL ?? "tradestockswithai@gmail.com";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return {
      mode: "mock",
      id: null,
      status: "preview",
      from,
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

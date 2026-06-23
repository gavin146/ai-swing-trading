export async function sendTwilioSms(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    return {
      mode: "unconfigured",
      sid: null,
      status: "failed",
      error: "Twilio credentials are not configured.",
    };
  }

  const params = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    params.set("From", from);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  const payload = (await response.json()) as {
    sid?: string;
    status?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      mode: "twilio",
      sid: payload.sid ?? null,
      status: "failed",
      error: payload.message ?? "Twilio request failed",
    };
  }

  return {
    mode: "twilio",
    sid: payload.sid ?? null,
    status: payload.status ?? "queued",
  };
}

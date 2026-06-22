import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage, buildMorningEmailAlert } from "@/lib/alerts";
import { runDailyRankingAgent, runFmpDailyRankingAgent } from "@/lib/agent";
import { sendEmail } from "@/lib/email";
import { sendTwilioSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function getEmailRecipients() {
  const configured = process.env.ALERT_CUSTOMER_EMAILS ?? process.env.ALERT_TEST_EMAIL ?? "";

  return configured
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

async function runMorningAlerts(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = getEmailRecipients();
  const phone = process.env.ALERT_TEST_PHONE;
  const customerName = process.env.ALERT_TEST_CUSTOMER_NAME ?? "Demo Investor";
  const result =
    process.env.AGENT_DATA_SOURCE === "fmp"
      ? await runFmpDailyRankingAgent({ limit: 30 })
      : runDailyRankingAgent({ limit: 30 });
  const deliveries = [];

  if (emails.length > 0) {
    const emailAlert = buildMorningEmailAlert({
      customerName,
      marketRegime: result.marketRegime,
      opportunities: result.opportunities,
    });

    for (const email of emails) {
      const delivery = await sendEmail({
        to: email,
        ...emailAlert,
      });

      deliveries.push({
        channel: "email",
        to: email,
        delivery,
        preview: emailAlert,
      });
    }
  }

  if (phone) {
    const message = buildMorningAlertMessage({
      customerName,
      marketRegime: result.marketRegime,
      opportunities: result.opportunities,
    });
    const delivery = await sendTwilioSms(phone, message);

    deliveries.push({
      channel: "sms",
      delivery,
      message,
    });
  }

  if (deliveries.length === 0) {
    const emailAlert = buildMorningEmailAlert({
      customerName,
      marketRegime: result.marketRegime,
      opportunities: result.opportunities,
    });

    return NextResponse.json({
      sent: 0,
      mode: "preview",
      email: emailAlert,
      note:
        "Set ALERT_CUSTOMER_EMAILS as a comma-separated list for scheduled customer email. ALERT_TEST_PHONE is still supported for later SMS testing.",
    });
  }

  return NextResponse.json({
    sent: deliveries.filter((item) => item.delivery.status !== "failed").length,
    deliveries,
  });
}

export async function GET(request: NextRequest) {
  return runMorningAlerts(request);
}

export async function POST(request: NextRequest) {
  return runMorningAlerts(request);
}

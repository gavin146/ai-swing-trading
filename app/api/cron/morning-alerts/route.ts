import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage } from "@/lib/alerts";
import { runDailyRankingAgent } from "@/lib/agent";
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

async function runMorningAlerts(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = process.env.ALERT_TEST_PHONE;
  const customerName = process.env.ALERT_TEST_CUSTOMER_NAME ?? "Demo Investor";
  const result = runDailyRankingAgent({ limit: 30 });
  const message = buildMorningAlertMessage({
    customerName,
    marketRegime: result.marketRegime,
    opportunities: result.opportunities,
  });

  if (!phone) {
    return NextResponse.json({
      sent: 0,
      mode: "preview",
      message,
      note:
        "Set ALERT_TEST_PHONE for scheduled demo SMS. Supabase customer lookup will replace this env recipient in production.",
    });
  }

  const delivery = await sendTwilioSms(phone, message);

  return NextResponse.json({
    sent: delivery.status === "failed" ? 0 : 1,
    delivery,
    message,
  });
}

export async function GET(request: NextRequest) {
  return runMorningAlerts(request);
}

export async function POST(request: NextRequest) {
  return runMorningAlerts(request);
}

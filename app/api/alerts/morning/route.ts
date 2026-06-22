import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage, buildMorningEmailAlert } from "@/lib/alerts";
import { runDailyRankingAgent, runFmpDailyRankingAgent } from "@/lib/agent";
import { sendEmail } from "@/lib/email";
import { sendTwilioSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AlertRequest = {
  customerName?: string;
  email?: string;
  phone?: string;
};

async function runConfiguredAgent() {
  if (process.env.AGENT_DATA_SOURCE === "fmp") {
    return runFmpDailyRankingAgent({ limit: 30 });
  }

  return runDailyRankingAgent({ limit: 30 });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AlertRequest;
  const email = body.email?.trim();
  const phone = body.phone?.trim();

  if (!email && !phone) {
    return NextResponse.json(
      { error: "An email address or phone number is required for morning alerts." },
      { status: 400 },
    );
  }

  const result = await runConfiguredAgent();
  const customerName = body.customerName?.trim() || "Investor";
  const deliveries = [];

  if (email) {
    const emailAlert = buildMorningEmailAlert({
      customerName,
      marketRegime: result.marketRegime,
      opportunities: result.opportunities,
    });
    const delivery = await sendEmail({
      to: email,
      ...emailAlert,
    });

    deliveries.push({
      channel: "email",
      delivery,
      preview: emailAlert,
    });
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

  return NextResponse.json({
    deliveries,
    topSymbols: result.opportunities.slice(0, 5).map((item) => item.symbol),
  });
}

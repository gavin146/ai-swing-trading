import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage, buildMorningEmailAlert } from "@/lib/alerts";
import { runFmpDailyRankingAgent } from "@/lib/agent";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
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
  if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
    throw new Error("FMP_API_KEY is required for live morning alerts.");
  }

  return runFmpDailyRankingAgent({ limit: 30 });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as AlertRequest;
  const email = body.email?.trim();
  const phone = body.phone?.trim();

  if (!email && !phone) {
    return NextResponse.json(
      { error: "An email address or phone number is required for morning alerts." },
      { status: 400 },
    );
  }

  let result;

  try {
    result = await runConfiguredAgent();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Live ranking failed." },
      { status: 503 },
    );
  }

  const customerName = body.customerName?.trim() ?? "";
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

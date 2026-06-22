import { NextRequest, NextResponse } from "next/server";
import { buildMorningAlertMessage } from "@/lib/alerts";
import { runDailyRankingAgent } from "@/lib/agent";
import { sendTwilioSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AlertRequest = {
  customerName?: string;
  phone?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AlertRequest;
  const phone = body.phone?.trim();

  if (!phone) {
    return NextResponse.json(
      { error: "A phone number is required for SMS alerts." },
      { status: 400 },
    );
  }

  const result = runDailyRankingAgent({ limit: 30 });
  const message = buildMorningAlertMessage({
    customerName: body.customerName?.trim() || "Investor",
    marketRegime: result.marketRegime,
    opportunities: result.opportunities,
  });
  const delivery = await sendTwilioSms(phone, message);

  return NextResponse.json({
    delivery,
    message,
    topSymbols: result.opportunities.slice(0, 3).map((item) => item.symbol),
  });
}

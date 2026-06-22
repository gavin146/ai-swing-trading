import { NextRequest, NextResponse } from "next/server";
import { buildMorningEmailAlert } from "@/lib/alerts";
import { runDailyRankingAgent, runFmpDailyRankingAgent } from "@/lib/agent";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EmailAlertRequest = {
  customerName?: string;
  email?: string;
};

async function runConfiguredAgent() {
  if (process.env.AGENT_DATA_SOURCE === "fmp") {
    return runFmpDailyRankingAgent({ limit: 30 });
  }

  return runDailyRankingAgent({ limit: 30 });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as EmailAlertRequest;
  const email = body.email?.trim();

  if (!email) {
    return NextResponse.json(
      { error: "An email address is required for email alerts." },
      { status: 400 },
    );
  }

  const result = await runConfiguredAgent();
  const emailAlert = buildMorningEmailAlert({
    customerName: body.customerName?.trim() || "Investor",
    marketRegime: result.marketRegime,
    opportunities: result.opportunities,
  });
  const delivery = await sendEmail({
    to: email,
    ...emailAlert,
  });

  return NextResponse.json({
    delivery,
    email: emailAlert,
    topSymbols: result.opportunities.slice(0, 5).map((item) => item.symbol),
  });
}

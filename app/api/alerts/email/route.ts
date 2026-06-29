import { NextRequest, NextResponse } from "next/server";
import { buildMorningEmailAlert } from "@/lib/alerts";
import { runFmpDailyRankingAgent } from "@/lib/agent";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email";
import { persistAgentRun, persistAlertLog } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EmailAlertRequest = {
  customerName?: string;
  email?: string;
};

async function runConfiguredAgent() {
  if (!process.env.FMP_API_KEY && !process.env.FINANCIAL_DATA_API_KEY) {
    throw new Error("FMP_API_KEY is required for live email alerts.");
  }

  return runFmpDailyRankingAgent({ limit: 30 });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as EmailAlertRequest;
  const email = body.email?.trim();

  if (!email) {
    return NextResponse.json(
      { error: "An email address is required for email alerts." },
      { status: 400 },
    );
  }

  let result;

  try {
    result = await runConfiguredAgent();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Live ranking failed.",
      },
      { status: 503 },
    );
  }
  const persistence = await persistAgentRun(result);
  const emailAlert = buildMorningEmailAlert({
    customerName: body.customerName?.trim() ?? "",
    marketRegime: result.marketRegime,
    opportunities: result.opportunities,
  });
  const delivery = await sendEmail({
    to: email,
    ...emailAlert,
  });
  await persistAlertLog({
    agentRunId: result.runId,
    channel: "email",
    status: delivery.status,
    recipient: email,
    message: emailAlert.text,
    providerMessageId: delivery.id,
    errorMessage: "error" in delivery ? delivery.error : null,
  });

  return NextResponse.json({
    delivery,
    email: emailAlert,
    persistence,
    topSymbols: result.opportunities.slice(0, 5).map((item) => item.symbol),
  });
}

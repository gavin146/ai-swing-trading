import { NextRequest, NextResponse } from "next/server";
import { getAdminUnauthorizedResponse, isAdminApiRequest } from "@/lib/auth/admin";
import { buildCopilotDailyDigestEmail } from "@/lib/copilot/email";
import {
  buildCopilotUiViewModel,
  createCopilotDemoSnapshot,
} from "@/lib/copilot/ui-view-model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAppUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  if (!(await isAdminApiRequest(request))) {
    return NextResponse.json(getAdminUnauthorizedResponse(), { status: 403 });
  }

  const appUrl = getAppUrl(request);
  const now = new Date("2026-07-17T13:30:00.000Z");
  const viewModel = await buildCopilotUiViewModel({
    mode: "fixture",
    now,
    opportunities: [
      {
        asset_type: "stock",
        confidence: 78,
        created_at: now.toISOString(),
        entry_high: 112,
        entry_low: 106,
        expected_gain: 8.7,
        expected_loss: 5.2,
        explanation:
          "Demo research opportunity with supplied score, confidence, risk, entry, target, and stop for admin preview only.",
        holding_period_days: 10,
        id: "fixture-long-symbol-opportunity",
        risk_score: 42,
        score: 82,
        stop_loss: 100.5,
        symbol: "AMZN",
        target_price: 116,
      },
      {
        asset_type: "stock",
        confidence: 72,
        created_at: now.toISOString(),
        entry_high: 77,
        entry_low: 72,
        expected_gain: 7.8,
        expected_loss: 4.6,
        explanation:
          "Demo long company-name row used to check wrapping and mobile-friendly rendering in the Copilot email preview.",
        holding_period_days: 9,
        id: "fixture-long-company-name",
        risk_score: 48,
        score: 76,
        stop_loss: 68.5,
        symbol: "VERYLONG",
        target_price: 82,
      },
    ],
    snapshot: createCopilotDemoSnapshot(now),
    warnings: ["Demo fixture only. This preview is not live customer, account, or brokerage data."],
  });
  viewModel.researchOpportunities = viewModel.researchOpportunities.map((item) =>
    item.symbol === "VERYLONG"
      ? {
          ...item,
          companyName: "Very Long Company Name Incorporated For Email Wrapping Preview",
        }
      : item,
  );
  const email = buildCopilotDailyDigestEmail({
    copilotUrl: `${appUrl}/copilot`,
    customerName: "SwingFi Admin",
    unsubscribeUrl: `${appUrl}/unsubscribe`,
    viewModel,
  });

  if (request.nextUrl.searchParams.get("format") === "html") {
    return new NextResponse(email.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-SwingFi-Preview": "copilot-digest",
      },
    });
  }

  return NextResponse.json({
    email,
    meta: {
      mode: "fixture",
      sent: false,
      source: "admin-copilot-email-preview",
      warning: "Preview only. No email was sent.",
    },
    viewModel,
  });
}

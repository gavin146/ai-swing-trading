import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { generateOpenAiText, hasOpenAiApiKey } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CoachTrade = {
  daysHeld?: number;
  planStatus?: string;
  rewardRisk?: number;
  symbol?: string;
  unrealizedReturnPct?: number | null;
};

type CoachBody = {
  attentionCount?: number;
  averageRewardRisk?: number;
  invested?: number;
  openReturn?: number;
  riskAtStop?: number;
  targetUpside?: number;
  trades?: CoachTrade[];
};

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeTrade(value: CoachTrade) {
  return {
    daysHeld: numberOrNull(value.daysHeld),
    planStatus: String(value.planStatus ?? "Unknown").slice(0, 60),
    rewardRisk: numberOrNull(value.rewardRisk),
    symbol: String(value.symbol ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12),
    unrealizedReturnPct: numberOrNull(value.unrealizedReturnPct),
  };
}

export async function POST(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  if (!hasOpenAiApiKey()) {
    return NextResponse.json(
      { error: "OpenAI is not configured for portfolio coaching yet." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as CoachBody;
  const trades = (Array.isArray(body.trades) ? body.trades : [])
    .slice(0, 12)
    .map(safeTrade)
    .filter((trade) => trade.symbol);

  const response = await generateOpenAiText({
    maxTokens: 280,
    messages: [
      {
        role: "system",
        content:
          "You are SwingFi's portfolio research coach for beginner swing traders. Be concise, practical, and cautious. Do not provide personalized financial advice, do not tell the user to buy or sell, and do not promise returns. Focus on what to review first, risk discipline, and trade-plan hygiene.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "Write a portfolio review in under 150 words. Include 3 short next-review actions. Use plain English and frame every point as research to review, not a trade command.",
          metrics: {
            attentionCount: numberOrNull(body.attentionCount),
            averageRewardRisk: numberOrNull(body.averageRewardRisk),
            invested: numberOrNull(body.invested),
            openReturn: numberOrNull(body.openReturn),
            riskAtStop: numberOrNull(body.riskAtStop),
            targetUpside: numberOrNull(body.targetUpside),
          },
          trades,
        }),
      },
    ],
  });

  if (response.error || !response.text) {
    return NextResponse.json(
      { error: response.error ?? "SwingFi could not generate a portfolio coach note." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    mode: response.mode,
    text: response.text,
  });
}

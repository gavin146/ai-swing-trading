import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { generateOpenAiText, hasOpenAiApiKey } from "@/lib/openai";
import {
  buildPortfolioPlainInsight,
  normalizePlainInsight,
  type PlainLanguageInsight,
  type PortfolioInsightInput,
} from "@/lib/plain-language-insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  trades?: PortfolioInsightInput[];
};

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanTrade(value: unknown): PortfolioInsightInput | null {
  const input = value as Partial<PortfolioInsightInput>;
  const symbol = String(input?.symbol ?? "").toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  const entryPrice = Number(input?.entryPrice);
  const targetPrice = Number(input?.targetPrice);
  const stopLoss = Number(input?.stopLoss);

  if (!symbol || !Number.isFinite(entryPrice) || !Number.isFinite(targetPrice) || !Number.isFinite(stopLoss)) {
    return null;
  }

  return {
    currentPrice: numberOrNull(input.currentPrice),
    daysHeld: Number(input.daysHeld) || 0,
    directionRead: typeof input.directionRead === "string" ? input.directionRead.slice(0, 500) : "",
    entryPrice,
    latestNews: Array.isArray(input.latestNews)
      ? input.latestNews
          .filter((item) => typeof item?.title === "string" && item.title.trim())
          .slice(0, 3)
          .map((item) => ({ title: item.title.slice(0, 180) }))
      : [],
    liveRead: typeof input.liveRead === "string" ? input.liveRead.slice(0, 500) : "",
    nextReview: typeof input.nextReview === "string" ? input.nextReview.slice(0, 500) : "",
    planStatus: String(input.planStatus ?? "Inside plan"),
    plannedHoldingDays: numberOrNull(input.plannedHoldingDays),
    stopLoss,
    symbol,
    targetPrice,
    unrealizedReturnPct: numberOrNull(input.unrealizedReturnPct),
  };
}

function parseInsightsJson(text: string, fallbacks: Record<string, PlainLanguageInsight>) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { insights?: Partial<PlainLanguageInsight>[] };
  const insights = Array.isArray(parsed.insights) ? parsed.insights : [];

  return Object.fromEntries(
    Object.entries(fallbacks).map(([symbol, fallback]) => {
      const aiValue = insights.find(
        (item) => String(item?.symbol ?? "").toUpperCase() === symbol,
      );

      return [
        symbol,
        normalizePlainInsight(
          aiValue ? { ...aiValue, mode: "openai" } : null,
          fallback,
        ),
      ];
    }),
  );
}

export async function POST(request: Request) {
  const session = await resolveCustomerSession(request);
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const trades = (body?.trades ?? [])
    .map(cleanTrade)
    .filter((item): item is PortfolioInsightInput => Boolean(item))
    .slice(0, 40);

  if (!trades.length) {
    return NextResponse.json({ insights: {}, mode: "deterministic" });
  }

  const fallbacks = Object.fromEntries(
    trades.map((trade) => [trade.symbol, buildPortfolioPlainInsight(trade)]),
  );

  if (!hasOpenAiApiKey()) {
    return NextResponse.json({ insights: fallbacks, mode: "deterministic" });
  }

  const response = await generateOpenAiText({
    maxTokens: 2600,
    messages: [
      {
        role: "system",
        content:
          "You write SwingFi portfolio research notes for beginner swing traders. Use only the provided data. Do not invent prices, news, earnings, filings, analyst actions, or revenue. Do not say buy, sell, must, guaranteed, or sure thing. Explain whether each tracked position is strengthening, weakening, near target, near stop, or mainly time-window review. Output strict JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instructions:
            "For each trade, return symbol, headline, summary, evidence array of 3 short strings, nextReview, and riskNote. Make it concrete: current price if present, open return, target/stop distance, time window, and headline context.",
          trades,
        }),
      },
    ],
  });

  if (!response.text) {
    return NextResponse.json({
      error: response.error,
      insights: fallbacks,
      mode: "deterministic",
    });
  }

  try {
    return NextResponse.json({
      insights: parseInsightsJson(response.text, fallbacks),
      mode: "openai",
    });
  } catch {
    return NextResponse.json({
      error: "OpenAI returned text that could not be parsed safely.",
      insights: fallbacks,
      mode: "deterministic",
    });
  }
}

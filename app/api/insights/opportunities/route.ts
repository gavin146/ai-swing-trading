import { NextResponse } from "next/server";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { generateOpenAiText, hasOpenAiApiKey } from "@/lib/openai";
import {
  buildOpportunityPlainInsight,
  normalizePlainInsight,
  type OpportunityInsightInput,
  type PlainLanguageInsight,
} from "@/lib/plain-language-insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  opportunities?: OpportunityInsightInput[];
};

function cleanOpportunity(value: unknown): OpportunityInsightInput | null {
  const input = value as Partial<OpportunityInsightInput>;
  const symbol = String(input?.symbol ?? "").toUpperCase().replace(/[^A-Z0-9.-]/g, "");

  if (!symbol) return null;

  return {
    aiExplanation: typeof input.aiExplanation === "string" ? input.aiExplanation.slice(0, 900) : "",
    confidenceScore: Number(input.confidenceScore) || 0,
    entryRange: String(input.entryRange ?? "the planned entry range"),
    expectedGainValue: Number(input.expectedGainValue) || 0,
    expectedLossValue: Number(input.expectedLossValue) || 0,
    holdingPeriodDays: Number(input.holdingPeriodDays) || 10,
    opportunityScore: Number(input.opportunityScore) || 0,
    rankingSummary: typeof input.rankingSummary === "string" ? input.rankingSummary.slice(0, 600) : "",
    riskScore: Number(input.riskScore) || 0,
    setupPattern: typeof input.setupPattern === "string" ? input.setupPattern : "",
    stopLoss: String(input.stopLoss ?? "the saved stop"),
    symbol,
    targetPrice: String(input.targetPrice ?? "the saved target"),
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
  const opportunities = (body?.opportunities ?? [])
    .map(cleanOpportunity)
    .filter((item): item is OpportunityInsightInput => Boolean(item))
    .slice(0, 30);

  if (!opportunities.length) {
    return NextResponse.json({ insights: {}, mode: "deterministic" });
  }

  const fallbacks = Object.fromEntries(
    opportunities.map((opportunity) => [
      opportunity.symbol,
      buildOpportunityPlainInsight(opportunity),
    ]),
  );

  if (!hasOpenAiApiKey()) {
    return NextResponse.json({ insights: fallbacks, mode: "deterministic" });
  }

  const response = await generateOpenAiText({
    maxTokens: 2200,
    messages: [
      {
        role: "system",
        content:
          "You write SwingFi beginner research notes. Use only the provided data. Do not invent revenue, earnings, analyst actions, news, prices, or institutional activity. Do not say buy, sell, must, guaranteed, or sure thing. Use plain English for beginner swing traders. Be specific with the provided scores, entry, target, stop, upside/downside, and explanation. Output strict JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instructions:
            "For each ticker, return an insight with symbol, headline, summary, evidence array of 3 short strings, nextReview, and riskNote. Explain what the ranking means in concrete plain language, not jargon. If data is missing, say what is missing.",
          opportunities,
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

import { NextRequest, NextResponse } from "next/server";
import { runDailyRankingAgent, runFmpDailyRankingAgent } from "@/lib/agent";
import { generateOpenAiText, hasOpenAiApiKey } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExplainRequest = {
  symbol?: string;
  source?: "mock" | "fmp";
};

async function runConfiguredAgent(source: "mock" | "fmp") {
  if (source === "fmp") {
    return runFmpDailyRankingAgent({ limit: 30 });
  }

  return runDailyRankingAgent({ limit: 30 });
}
export async function GET() {
  return NextResponse.json({
    configured: hasOpenAiApiKey(),
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ExplainRequest;
  const source = body.source === "mock" ? "mock" : "fmp";
  const symbol = body.symbol?.trim().toUpperCase();
  const result = await runConfiguredAgent(source);
  const ranking =
    result.rankings.find((item) => item.candidate.symbol === symbol) ?? result.rankings[0];

  if (!ranking) {
    return NextResponse.json({ error: "No ranking was available to explain." }, { status: 404 });
  }

  const response = await generateOpenAiText({
    maxTokens: 420,
    messages: [
      {
        role: "system",
        content:
          "You explain swing-trading research for beginner investors. Be concise, factual, cautious, and never promise returns. Do not provide personalized financial advice.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "Explain why this stock ranked where it did. Include strengths, risks, and what the investor should monitor. Keep it under 180 words.",
          symbol: ranking.candidate.symbol,
          companyName: ranking.candidate.companyName,
          rank: ranking.rank,
          scores: ranking.scores,
          opportunity: ranking.opportunity,
          technical: ranking.candidate.technical,
          financials: ranking.candidate.financials,
          news: ranking.candidate.news,
          market: ranking.candidate.market,
          dataQuality: result.dataQuality,
        }),
      },
    ],
  });

  return NextResponse.json({
    symbol: ranking.candidate.symbol,
    mode: response.mode,
    explanation:
      response.text ??
      `${ranking.candidate.symbol} ranked #${ranking.rank} because the deterministic model found a ${ranking.scores.technical}/100 technical score, ${ranking.scores.financial}/100 financial score, ${ranking.scores.news}/100 news/catalyst score, and ${ranking.scores.risk}/100 risk score. OpenAI explanation generation is unavailable: ${response.error}`,
    error: response.error,
  });
}

import { NextRequest, NextResponse } from "next/server";
import type { OpportunityRow, PredictionOutcomeRow, TradeHistoryRow, UserRow } from "@/lib/database.types";
import { resolveResearchAccess } from "@/lib/auth/research-access";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { generateOpenAiText, hasOpenAiApiKey } from "@/lib/openai";
import {
  getTradeLiveIntelligence,
  type PortfolioNewsItem,
} from "@/lib/portfolio/intelligence";
import { getFmpCompanyProfile, getFmpStockNews } from "@/lib/providers/fmp";
import { listLatestOpportunities } from "@/lib/repositories/opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AssistantBody = {
  message?: string;
};

type AssistantTrade = TradeHistoryRow & {
  currentPrice?: number | null;
  latestNews?: PortfolioNewsItem[];
  liveIntelligence?: ReturnType<typeof getTradeLiveIntelligence>;
};

function clampText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not available";

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not available";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function rewardRisk(row: OpportunityRow) {
  return row.expected_loss > 0 ? row.expected_gain / row.expected_loss : null;
}

function summarizeOpportunity(row: OpportunityRow, index: number) {
  return {
    rank: index + 1,
    symbol: row.symbol,
    assetType: row.asset_type,
    score: row.score,
    confidence: row.confidence,
    riskScore: row.risk_score,
    entryRange: `${formatCurrency(row.entry_low)} - ${formatCurrency(row.entry_high)}`,
    target: formatCurrency(row.target_price),
    stop: formatCurrency(row.stop_loss),
    expectedGain: formatPercent(row.expected_gain),
    expectedLoss: formatPercent(-Math.abs(row.expected_loss)),
    rewardRisk: rewardRisk(row)?.toFixed(1) ?? "not available",
    holdingPeriodDays: row.holding_period_days,
    explanation: clampText(row.explanation, 420),
  };
}

function getPlannedHoldingDays(notes: unknown) {
  const text = clampText(notes, 1200);
  const match =
    text.match(/planned hold:\s*(\d+)\s*days/i) ??
    text.match(/estimated a\s*(\d+)-day holding window/i);
  const parsed = Number(match?.[1]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function daysBetween(start: string | null) {
  if (!start) return 0;
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000));
}

async function enrichTradeForAssistant(row: TradeHistoryRow): Promise<AssistantTrade> {
  const [profile, news] = await Promise.all([
    getFmpCompanyProfile(row.symbol).catch(() => null),
    getFmpStockNews(row.symbol, 5).catch(() => []),
  ]);
  const currentPrice = Number(profile?.price);
  const cleanCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null;
  const latestNews = news
    .filter((item) => item.title)
    .slice(0, 5)
    .map((item) => ({
      publishedDate: item.publishedDate ?? null,
      site: item.site ?? item.publisher ?? null,
      title: item.title ?? "",
      url: item.url ?? null,
    }));
  const entryPrice = Number(row.entry_price);
  const unrealizedReturnPct =
    cleanCurrentPrice && entryPrice > 0 ? ((cleanCurrentPrice - entryPrice) / entryPrice) * 100 : null;
  const plannedHoldingDays = getPlannedHoldingDays(row.notes);
  const liveIntelligence = getTradeLiveIntelligence({
    currentPrice: cleanCurrentPrice,
    daysHeld: daysBetween(row.opened_at),
    entryPrice,
    latestNews,
    plannedHoldingDays,
    planStatus: row.status,
    stopLoss: Number(row.stop_loss),
    symbol: row.symbol,
    targetPrice: Number(row.target_price),
    unrealizedReturnPct,
  });

  return {
    ...row,
    currentPrice: cleanCurrentPrice,
    latestNews,
    liveIntelligence,
  };
}

function summarizeTrade(row: AssistantTrade) {
  const entry = Number(row.entry_price);
  const target = Number(row.target_price);
  const stop = Number(row.stop_loss);
  const risk = entry > stop ? entry - stop : null;
  const reward = target > entry ? target - entry : null;

  return {
    symbol: row.symbol,
    status: row.status,
    assetType: row.asset_type,
    entry: formatCurrency(entry),
    target: formatCurrency(target),
    stop: formatCurrency(stop),
    quantity: Number(row.quantity),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    currentPrice: formatCurrency(row.currentPrice),
    latestNews: row.latestNews?.slice(0, 3).map((item) => item.title) ?? [],
    liveRead: row.liveIntelligence
      ? {
          decisionZone: row.liveIntelligence.decisionZone,
          directionRead: row.liveIntelligence.directionRead,
          headlineContext: row.liveIntelligence.news.summary,
          liveRead: row.liveIntelligence.liveRead,
          nextReview: row.liveIntelligence.nextReview,
          priceFacts: row.liveIntelligence.priceFacts,
        }
      : null,
    rewardRisk: risk && reward ? (reward / risk).toFixed(1) : "not available",
    notes: clampText(row.notes, 360),
  };
}

function summarizeOutcomes(outcomes: PredictionOutcomeRow[]) {
  const evaluated = outcomes.filter((row) => row.evaluated_at);
  const targetHits = evaluated.filter((row) => row.status === "target_hit").length;
  const stopHits = evaluated.filter((row) => row.status === "stop_hit").length;
  const noEntry = evaluated.filter((row) => row.status === "no_entry").length;
  const avgReturn =
    evaluated.length > 0
      ? evaluated.reduce((total, row) => total + Number(row.return_pct ?? 0), 0) / evaluated.length
      : null;
  const avgExcess =
    evaluated.length > 0
      ? evaluated.reduce((total, row) => total + Number(row.excess_return_pct ?? 0), 0) / evaluated.length
      : null;

  return {
    evaluatedCount: evaluated.length,
    targetHitRate: evaluated.length ? `${((targetHits / evaluated.length) * 100).toFixed(1)}%` : "not enough data",
    stopHitRate: evaluated.length ? `${((stopHits / evaluated.length) * 100).toFixed(1)}%` : "not enough data",
    noEntryRate: evaluated.length ? `${((noEntry / evaluated.length) * 100).toFixed(1)}%` : "not enough data",
    averageReturn: formatPercent(avgReturn),
    averageExcessReturn: formatPercent(avgExcess),
    recentOutcomes: evaluated.slice(0, 12).map((row) => ({
      symbol: row.symbol,
      rank: row.rank,
      score: row.score,
      status: row.status,
      returnPct: formatPercent(row.return_pct),
      excessReturnPct: formatPercent(row.excess_return_pct),
      predictionDate: row.prediction_date,
    })),
  };
}

function fallbackAnswer(args: {
  message: string;
  opportunities: OpportunityRow[];
  openTrades: AssistantTrade[];
}) {
  const top = args.opportunities.slice(0, 3).map((row, index) => summarizeOpportunity(row, index));
  const tradeSummary = args.openTrades.slice(0, 3).map(summarizeTrade);
  const topLines = top.map(
    (item) =>
      `${item.symbol} (#${item.rank}): score ${item.score}, confidence ${item.confidence}, risk ${item.riskScore}. Entry ${item.entryRange}, target ${item.target}, stop ${item.stop}, ${item.rewardRisk}R reward/risk.`,
  );
  const tradeLines = tradeSummary.map((item) => {
    const liveFacts = item.liveRead?.priceFacts?.join("; ") ?? "latest live facts unavailable";

    return `${item.symbol}: ${item.status}. Entry ${item.entry}, target ${item.target}, stop ${item.stop}. ${liveFacts}. ${item.liveRead?.nextReview ?? "Review the saved plan before acting."}`;
  });

  return [
    "SwingFi built-in read:",
    "",
    topLines.length
      ? `Ranked opportunities:\n- ${topLines.join("\n- ")}`
      : "No ranked opportunities are available in the current context.",
    tradeLines.length
      ? `Tracked portfolio:\n- ${tradeLines.join("\n- ")}`
      : "You do not have open tracked portfolio trades in this context.",
    "",
    "Next review step: pick one ticker, compare current price with the saved entry, target, and stop, then read any fresh headline before deciding what to do in your brokerage.",
    "Risk reminder: SwingFi is research software. It does not place trades, guarantee outcomes, or replace your own risk review.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const access = await resolveResearchAccess(request);
  if (!access.allowed) {
    return NextResponse.json(access.body, { status: access.status });
  }

  const body = (await request.json().catch(() => ({}))) as AssistantBody;
  const message = clampText(body.message, 1000);

  if (message.length < 3) {
    return NextResponse.json({ error: "Ask SwingFi a question about rankings, risk, entries, stops, or your portfolio." }, { status: 400 });
  }

  const session = await resolveCustomerSession(request);
  const supabase = session.error ? null : session.supabase;
  const user = session.error ? null : session.user;

  const [opportunityResult, userProfileResult, tradeResult, outcomeResult] = await Promise.all([
    listLatestOpportunities(30),
    supabase && user
      ? supabase
          .from("users")
          .select("id,email,role,risk_profile,account_budget,investing_experience,position_size_preference,setup_preference,minimum_confidence,max_risk_score,preferred_brokerage")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase && user
      ? supabase
          .from("trade_history")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["open", "planned"])
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    supabase
      ? supabase
          .from("prediction_outcomes")
          .select("*")
          .order("prediction_date", { ascending: false })
          .limit(120)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const opportunities = opportunityResult.rows.slice(0, 30);
  const userProfile = (userProfileResult.data ?? null) as Partial<UserRow> | null;
  const rawOpenTrades = ((tradeResult.data ?? []) as TradeHistoryRow[]).slice(0, 20);
  const openTrades = await Promise.all(rawOpenTrades.slice(0, 12).map(enrichTradeForAssistant));
  const outcomes = ((outcomeResult.data ?? []) as PredictionOutcomeRow[]).slice(0, 120);
  const context = {
    userProfile: userProfile
      ? {
          riskProfile: userProfile.risk_profile,
          investingExperience: userProfile.investing_experience,
          budget: userProfile.account_budget,
          setupPreference: userProfile.setup_preference,
          minimumConfidence: userProfile.minimum_confidence,
          maxRiskScore: userProfile.max_risk_score,
          preferredBrokerage: userProfile.preferred_brokerage,
        }
      : null,
    dataUsedToday: {
      source: opportunityResult.source,
      reason: opportunityResult.reason ?? null,
      trust: opportunityResult.trust
        ? {
            dataFeeds: opportunityResult.trust.dataFeeds,
            lastRunAt: opportunityResult.trust.lastRunAt,
            marketRegime: opportunityResult.trust.marketRegime,
            runSource: opportunityResult.trust.runSource,
            universeCount: opportunityResult.trust.universeCount,
            marketCoverage: opportunityResult.trust.marketCoverage,
            calibrationStatus: opportunityResult.trust.calibrationStatus,
            openAiStatus: opportunityResult.trust.openAiStatus,
          }
        : null,
    },
    topOpportunities: opportunities.slice(0, 12).map(summarizeOpportunity),
    rankedSymbols: opportunities.map((row, index) => ({
      rank: index + 1,
      symbol: row.symbol,
      score: row.score,
      confidence: row.confidence,
      riskScore: row.risk_score,
      entryLow: row.entry_low,
      entryHigh: row.entry_high,
      target: row.target_price,
      stop: row.stop_loss,
      holdingPeriodDays: row.holding_period_days,
    })),
    trackedPortfolio: openTrades.map(summarizeTrade),
    predictionOutcomes: summarizeOutcomes(outcomes),
  };

  if (!hasOpenAiApiKey()) {
    return NextResponse.json({
      answer: fallbackAnswer({ message, opportunities, openTrades }),
      mode: "fallback",
      suggestions: [
        "Which top-ranked idea should I review first?",
        "What does the risk score mean?",
        "What should I check before tracking a trade?",
      ],
    });
  }

  const response = await generateOpenAiText({
    maxTokens: 650,
    messages: [
      {
        role: "system",
        content:
          "You are Ask SwingFi, a research assistant for beginner to intermediate swing traders. You answer using only the provided SwingFi context: latest ranked opportunities, data freshness, prediction outcomes, and the user's tracked portfolio. Be direct, practical, plain-English, and data-specific. No fluff, no generic market advice, no motivational filler. Every answer should reference concrete symbols, scores, entry ranges, targets, stops, current portfolio prices, distance-to-target/stop, headline context, or clearly say what data is missing. Do not claim certainty, do not promise returns, do not say buy, sell, must, guaranteed, sure thing, or best stock to buy. Do not recommend changing stops, changing position size, or placing orders. Use phrases like review, compare, check, watch, and confirm in your brokerage. SwingFi is research software, not financial advice and not a broker.",
      },
      {
        role: "user",
        content: JSON.stringify({
          userQuestion: message,
          responseInstructions:
            "Answer in this structure: 1) Direct answer in one short sentence. 2) What the data says: 2-4 bullets with exact symbols and numbers from context. 3) Beginner translation: explain what those facts mean without jargon. 4) Next review step: one concrete thing to check next. 5) Risk reminder: one sentence. If the question asks about a ticker not in context, say it is missing and suggest asking about a ranked or portfolio ticker. Do not invent live prices, revenue, financials, external headlines, or news not shown in context.",
          context,
        }),
      },
    ],
  });

  if (response.error || !response.text) {
    return NextResponse.json(
      { error: response.error ?? "Ask SwingFi could not generate an answer." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    answer: response.text,
    mode: response.mode,
    suggestions: [
      "Which setup is easiest for a beginner to review today?",
      "What should I check before tracking one of these trades?",
      "Which portfolio position needs attention first?",
    ],
  });
}

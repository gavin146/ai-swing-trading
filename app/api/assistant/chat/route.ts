import { NextRequest, NextResponse } from "next/server";
import type { OpportunityRow, PredictionOutcomeRow, TradeHistoryRow, UserRow } from "@/lib/database.types";
import { resolveResearchAccess } from "@/lib/auth/research-access";
import { resolveCustomerSession } from "@/lib/auth/customer-session";
import { generateOpenAiText, hasOpenAiApiKey } from "@/lib/openai";
import {
  getTradeLiveIntelligence,
  type PortfolioNewsItem,
} from "@/lib/portfolio/intelligence";
import {
  getFmpCompanyProfile,
  getFmpEarnings,
  getFmpHistoricalCandles,
  getFmpSecFilingsBySymbol,
  getFmpStockNews,
  type FmpHistoricalCandle,
} from "@/lib/providers/fmp";
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

type TickerEvidence = {
  symbol: string;
  companyName: string | null;
  currentPrice: string;
  dataCoverage: "strong" | "usable" | "thin";
  evidenceSummary: string;
  latestRankedSetup: ReturnType<typeof summarizeOpportunity> | null;
  portfolioPlan: ReturnType<typeof summarizeTrade> | null;
  recentTechnicals: {
    lastClose: string;
    return5d: string;
    return20d: string;
    priceVs20dAverage: string;
    volumeVs20dAverage: string;
  } | null;
  upcomingEvents: {
    earnings: string;
    secFilings: string[];
  };
  latestHeadlines: Array<{
    publishedDate?: string | null;
    site?: string | null;
    title: string;
  }>;
  addExposureRead: {
    classification: "worth reviewing" | "caution" | "insufficient live evidence";
    plainEnglish: string;
    dataBehindIt: string[];
  };
};

function clampText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeAssistantAnswer(text: string) {
  return text
    .replace(/\s+(Why:)/g, "\n\n$1")
    .replace(/\s+(Ticker reads:)/g, "\n\n$1")
    .replace(/\s+(What would change it:)/g, "\n\n$1")
    .replace(/\s+(Next check:)/g, "\n\n$1")
    .replace(/\s+(SwingFi is research software)/g, "\n\n$1")
    .trim();
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

function formatNumber(value: number | null | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not available";
  return value.toFixed(digits);
}

function rewardRisk(row: OpportunityRow) {
  return row.expected_loss > 0 ? row.expected_gain / row.expected_loss : null;
}

function percentMove(from: number | null | undefined, to: number | null | undefined) {
  if (
    typeof from !== "number" ||
    typeof to !== "number" ||
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from <= 0
  ) {
    return null;
  }

  return ((to - from) / from) * 100;
}

function findOpportunityForTrade(trade: TradeHistoryRow, opportunities: OpportunityRow[]) {
  return opportunities.find((row) => row.id === trade.opportunity_id) ??
    opportunities.find((row) => row.symbol.toUpperCase() === trade.symbol.toUpperCase()) ??
    null;
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function summarizeCandles(candles: FmpHistoricalCandle[]) {
  const clean = candles
    .filter((candle) => typeof candle.close === "number" && Number.isFinite(candle.close))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = clean.at(-1);

  if (!last?.close) return null;

  const close = Number(last.close);
  const fiveAgo = clean.at(-6)?.close;
  const twentyAgo = clean.at(-21)?.close;
  const lastTwenty = clean.slice(-20);
  const average20 =
    lastTwenty.length > 0
      ? lastTwenty.reduce((total, candle) => total + Number(candle.close ?? 0), 0) / lastTwenty.length
      : null;
  const latestVolume = Number(last.volume ?? 0);
  const averageVolume20 =
    lastTwenty.length > 0
      ? lastTwenty.reduce((total, candle) => total + Number(candle.volume ?? 0), 0) / lastTwenty.length
      : null;

  return {
    lastClose: close,
    return5d: fiveAgo ? percentMove(Number(fiveAgo), close) : null,
    return20d: twentyAgo ? percentMove(Number(twentyAgo), close) : null,
    priceVs20dAverage: average20 ? percentMove(average20, close) : null,
    volumeVs20dAverage:
      averageVolume20 && latestVolume > 0 ? percentMove(averageVolume20, latestVolume) : null,
  };
}

function extractRequestedSymbols(
  message: string,
  opportunities: OpportunityRow[],
  openTrades: AssistantTrade[],
) {
  const lowerMessage = message.toLowerCase();
  const symbols = new Set<string>();

  [...opportunities, ...openTrades].forEach((row) => {
    if (lowerMessage.includes(row.symbol.toLowerCase())) {
      symbols.add(row.symbol.toUpperCase());
    }
  });

  const companyAliases: Record<string, string> = {
    alphabet: "GOOGL",
    amazon: "AMZN",
    apple: "AAPL",
    meta: "META",
    microsoft: "MSFT",
    netflix: "NFLX",
    netapp: "NTAP",
    nvidia: "NVDA",
    tesla: "TSLA",
  };

  Object.entries(companyAliases).forEach(([name, symbol]) => {
    if (lowerMessage.includes(name)) symbols.add(symbol);
  });

  const explicitTickerMatches = message.matchAll(/\$?([A-Za-z]{1,5})(?=[\s,?.!)]|$)/g);
  const stopWords = new Set([
    "a",
    "ai",
    "and",
    "be",
    "can",
    "do",
    "for",
    "good",
    "idea",
    "in",
    "is",
    "it",
    "like",
    "me",
    "more",
    "my",
    "or",
    "stock",
    "the",
    "this",
    "to",
    "what",
    "would",
  ]);

  Array.from(explicitTickerMatches).forEach((match) => {
    const raw = match[1] ?? "";
    const normalized = raw.toUpperCase();

    if (stopWords.has(raw.toLowerCase())) return;
    if (normalized.length >= 2 && normalized.length <= 5) {
      symbols.add(normalized);
    }
  });

  return Array.from(symbols).slice(0, 8);
}

function classifyAddExposure(args: {
  symbol: string;
  opportunity: OpportunityRow | null;
  portfolioPlan: ReturnType<typeof summarizeTrade> | null;
  currentPrice: number | null;
  candles: ReturnType<typeof summarizeCandles>;
}) {
  const facts: string[] = [];

  if (args.portfolioPlan) {
    facts.push(
      `Portfolio plan: entry ${args.portfolioPlan.entry}, target ${args.portfolioPlan.target}, stop ${args.portfolioPlan.stop}, open return ${args.portfolioPlan.openReturn}.`,
    );
    facts.push(
      `Plan position: ${args.portfolioPlan.distanceToTarget} and ${args.portfolioPlan.distanceToStop}.`,
    );
  }

  if (args.opportunity) {
    facts.push(
      `Today's ranked setup: score ${args.opportunity.score}, confidence ${args.opportunity.confidence}, risk ${args.opportunity.risk_score}, entry ${formatCurrency(args.opportunity.entry_low)} - ${formatCurrency(args.opportunity.entry_high)}.`,
    );
  }

  if (args.candles) {
    facts.push(
      `Recent tape: 5-day return ${formatPercent(args.candles.return5d)}, 20-day return ${formatPercent(args.candles.return20d)}, price vs 20-day average ${formatPercent(args.candles.priceVs20dAverage)}.`,
    );
  }

  if (!args.currentPrice && !args.portfolioPlan && !args.opportunity) {
    return {
      classification: "insufficient live evidence" as const,
      dataBehindIt: facts,
      plainEnglish:
        "SwingFi does not have a current quote, saved plan, or latest ranked setup for this ticker, so it cannot give a useful add-more read yet.",
    };
  }

  if (args.portfolioPlan?.liveRead?.decisionZone?.toLowerCase().includes("stop")) {
    return {
      classification: "caution" as const,
      dataBehindIt: facts,
      plainEnglish:
        "This is a caution setup because the saved risk line is under pressure. Adding exposure would need a fresh plan, not just confidence in the original idea.",
    };
  }

  if (args.portfolioPlan?.liveRead?.decisionZone?.toLowerCase().includes("target")) {
    return {
      classification: "caution" as const,
      dataBehindIt: facts,
      plainEnglish:
        "This is closer to a profit-review question than an add-more question because the trade is near the planned reward area.",
    };
  }

  if (args.opportunity && args.currentPrice) {
    if (args.currentPrice > args.opportunity.entry_high) {
      return {
        classification: "caution" as const,
        dataBehindIt: facts,
        plainEnglish:
          "SwingFi would treat adding here as chasing because the current price is above the latest model entry range.",
      };
    }

    if (
      args.currentPrice >= args.opportunity.entry_low &&
      args.currentPrice <= args.opportunity.entry_high &&
      args.opportunity.confidence >= 65 &&
      args.opportunity.risk_score <= 60
    ) {
      return {
        classification: "worth reviewing" as const,
        dataBehindIt: facts,
        plainEnglish:
          "This is worth reviewing because price is still near the planned entry area and the latest setup has usable confidence without excessive risk.",
      };
    }
  }

  if (args.portfolioPlan || args.currentPrice || args.candles) {
    return {
      classification: "caution" as const,
      dataBehindIt: facts,
      plainEnglish:
        "SwingFi has enough evidence to review the position, but not enough to call it a clean add-more setup from the latest ranking rules.",
    };
  }

  return {
    classification: "insufficient live evidence" as const,
    dataBehindIt: facts,
    plainEnglish:
      "SwingFi needs a current quote, saved plan, or ranked setup before giving a useful add-more read.",
  };
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

function summarizeTrade(row: AssistantTrade, latestOpportunity?: OpportunityRow | null) {
  const entry = Number(row.entry_price);
  const target = Number(row.target_price);
  const stop = Number(row.stop_loss);
  const current = row.currentPrice ?? null;
  const risk = entry > stop ? entry - stop : null;
  const reward = target > entry ? target - entry : null;
  const positionValue =
    current && Number(row.quantity) > 0 ? current * Number(row.quantity) : null;
  const openReturnPct = current && entry > 0 ? percentMove(entry, current) : null;
  const targetDistancePct = current && target > 0 ? percentMove(current, target) : null;
  const stopDistancePct = current && stop > 0 ? percentMove(current, stop) : null;
  const daysHeld = daysBetween(row.opened_at);
  const plannedHoldingDays = getPlannedHoldingDays(row.notes);
  const daysLeft =
    typeof plannedHoldingDays === "number" ? plannedHoldingDays - daysHeld : null;
  const currentVsRankedEntry =
    latestOpportunity && current
      ? current < latestOpportunity.entry_low
        ? "below today's ranked entry range"
        : current <= latestOpportunity.entry_high
          ? "inside today's ranked entry range"
          : "above today's ranked entry range"
      : "no current ranked entry comparison";
  const addMoreReview =
    current && latestOpportunity
      ? {
          dataRead:
            current <= latestOpportunity.entry_high && current >= latestOpportunity.entry_low
              ? "Price is still inside the latest SwingFi entry range, so adding would at least be near the planned area."
              : current > latestOpportunity.entry_high
                ? "Price is above the latest SwingFi entry range, so adding here may mean chasing beyond the model's preferred entry area."
                : "Price is below the latest SwingFi entry range, so the setup may need fresh confirmation before adding exposure.",
          latestRank: "available in today's ranked opportunities",
          latestScore: latestOpportunity.score,
          latestConfidence: latestOpportunity.confidence,
          latestRiskScore: latestOpportunity.risk_score,
          latestEntryRange: `${formatCurrency(latestOpportunity.entry_low)} - ${formatCurrency(latestOpportunity.entry_high)}`,
        }
      : {
          dataRead:
            "This ticker is not in today's ranked opportunity set, so SwingFi has less evidence for adding exposure from the latest scan.",
          latestRank: "not in today's top ranked opportunities",
          latestScore: null,
          latestConfidence: null,
          latestRiskScore: null,
          latestEntryRange: null,
        };

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
    positionValue: formatCurrency(positionValue),
    daysHeld,
    plannedHoldingDays: plannedHoldingDays ?? "not available",
    daysLeft: daysLeft === null ? "not available" : daysLeft,
    openReturn: formatPercent(openReturnPct),
    distanceToTarget:
      targetDistancePct === null
        ? "not available"
        : targetDistancePct >= 0
          ? `${formatNumber(targetDistancePct)}% below target`
          : `${formatNumber(Math.abs(targetDistancePct))}% past target`,
    distanceToStop:
      stopDistancePct === null
        ? "not available"
        : stopDistancePct >= 0
          ? `${formatNumber(Math.abs(stopDistancePct))}% below stop`
          : `${formatNumber(Math.abs(stopDistancePct))}% above stop`,
    latestNews:
      row.latestNews?.slice(0, 5).map((item) => ({
        publishedDate: item.publishedDate,
        site: item.site,
        title: item.title,
      })) ?? [],
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
    currentVsRankedEntry,
    addMoreReview,
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

async function buildTickerEvidence(args: {
  message: string;
  opportunities: OpportunityRow[];
  openTrades: AssistantTrade[];
}) {
  const requestedSymbols = extractRequestedSymbols(args.message, args.opportunities, args.openTrades);

  if (!requestedSymbols.length) return [];

  const from = dateDaysAgo(90);
  const to = todayIsoDate();

  const evidence = await Promise.all(
    requestedSymbols.map(async (symbol): Promise<TickerEvidence> => {
      const opportunity =
        args.opportunities.find((row) => row.symbol.toUpperCase() === symbol) ?? null;
      const trade =
        args.openTrades.find((row) => row.symbol.toUpperCase() === symbol) ?? null;

      const [profile, news, candles, earnings, filings] = await Promise.all([
        getFmpCompanyProfile(symbol).catch(() => null),
        getFmpStockNews(symbol, 6).catch(() => []),
        getFmpHistoricalCandles(symbol, from, to).catch(() => []),
        getFmpEarnings(symbol, 3).catch(() => []),
        getFmpSecFilingsBySymbol(symbol, dateDaysAgo(45), to, 5).catch(() => []),
      ]);

      const currentPrice =
        typeof profile?.price === "number" && Number.isFinite(profile.price) && profile.price > 0
          ? profile.price
          : null;
      const candleSummary = summarizeCandles(candles);
      const portfolioPlan = trade ? summarizeTrade(trade, opportunity) : null;
      const latestRankedSetup = opportunity ? summarizeOpportunity(opportunity, 0) : null;
      const latestHeadlines = news
        .filter((item) => item.title)
        .slice(0, 5)
        .map((item) => ({
          publishedDate: item.publishedDate ?? null,
          site: item.site ?? item.publisher ?? null,
          title: item.title ?? "",
        }));
      const nextEarnings =
        earnings
          .map((item) => item.date)
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b)))
          .find((date) => String(date) >= to) ?? null;
      const addExposureRead = classifyAddExposure({
        candles: candleSummary,
        currentPrice: currentPrice ?? candleSummary?.lastClose ?? null,
        opportunity,
        portfolioPlan,
        symbol,
      });
      const dataPointCount = [
        currentPrice,
        candleSummary,
        latestHeadlines.length > 0,
        filings.length > 0,
        nextEarnings,
        opportunity,
        portfolioPlan,
      ].filter(Boolean).length;

      return {
        symbol,
        companyName: profile?.companyName ?? profile?.companyNameLong ?? null,
        currentPrice: formatCurrency(currentPrice ?? candleSummary?.lastClose),
        dataCoverage: dataPointCount >= 5 ? "strong" : dataPointCount >= 3 ? "usable" : "thin",
        evidenceSummary:
          dataPointCount >= 5
            ? "SwingFi has strong context: quote, price trend, portfolio/ranking context, headlines, and event checks."
            : dataPointCount >= 3
              ? "SwingFi has usable context for a research read, but one or more feeds are missing."
              : "SwingFi has thin context and should avoid a firm read.",
        latestRankedSetup,
        portfolioPlan,
        recentTechnicals: candleSummary
          ? {
              lastClose: formatCurrency(candleSummary.lastClose),
              return5d: formatPercent(candleSummary.return5d),
              return20d: formatPercent(candleSummary.return20d),
              priceVs20dAverage: formatPercent(candleSummary.priceVs20dAverage),
              volumeVs20dAverage: formatPercent(candleSummary.volumeVs20dAverage),
            }
          : null,
        upcomingEvents: {
          earnings: nextEarnings ? `next listed earnings date ${nextEarnings}` : "no upcoming earnings date found in the latest FMP check",
          secFilings: filings
            .slice(0, 3)
            .map((filing) => `${filing.formType ?? "filing"} on ${filing.filingDate ?? filing.acceptedDate ?? "unknown date"}`),
        },
        latestHeadlines,
        addExposureRead,
      };
    }),
  );

  return evidence;
}

function fallbackAnswer(args: {
  message: string;
  opportunities: OpportunityRow[];
  openTrades: AssistantTrade[];
  tickerEvidence?: TickerEvidence[];
}) {
  const top = args.opportunities.slice(0, 3).map((row, index) => summarizeOpportunity(row, index));
  const tradeSummary = args.openTrades.slice(0, 3).map((trade) =>
    summarizeTrade(trade, findOpportunityForTrade(trade, args.opportunities)),
  );
  const isAddMoreQuestion = /\b(buy more|purchase more|add more|add to|average|more shares)\b/i.test(args.message);
  const evidenceLines = (args.tickerEvidence ?? []).map((item) => {
    const facts = item.addExposureRead.dataBehindIt.slice(0, 3).join(" ");

    return `${item.symbol}: ${item.addExposureRead.classification}. ${item.addExposureRead.plainEnglish} ${facts}`;
  });
  const topLines = top.map(
    (item) =>
      `${item.symbol} (#${item.rank}): score ${item.score}, confidence ${item.confidence}, risk ${item.riskScore}. Entry ${item.entryRange}, target ${item.target}, stop ${item.stop}, ${item.rewardRisk}R reward/risk.`,
  );
  const tradeLines = tradeSummary.map((item) => {
    const liveFacts = item.liveRead?.priceFacts?.join("; ") ?? "latest live facts unavailable";

    return `${item.symbol}: ${item.status}. Entry ${item.entry}, target ${item.target}, stop ${item.stop}. ${liveFacts}. ${item.liveRead?.nextReview ?? "Review the saved plan before acting."}`;
  });
  const addMoreLines = tradeSummary.map(
    (item) =>
      `${item.symbol}: ${item.addMoreReview.dataRead} Current price ${item.currentPrice}, open return ${item.openReturn}, distance to target ${item.distanceToTarget}, distance to stop ${item.distanceToStop}.`,
  );

  return [
    "SwingFi built-in read:",
    "",
    evidenceLines.length
      ? `Ticker-specific answer:\n- ${evidenceLines.join("\n- ")}`
      : "",
    isAddMoreQuestion && addMoreLines.length
      ? `Adding-exposure research check:\n- ${addMoreLines.join("\n- ")}`
      : "",
    topLines.length
      ? `Ranked opportunities:\n- ${topLines.join("\n- ")}`
      : "No ranked opportunities are available in the current context.",
    tradeLines.length
      ? `Tracked portfolio:\n- ${tradeLines.join("\n- ")}`
      : "You do not have open tracked portfolio trades in this context.",
    "",
    "Next review step: compare whether the ticker is still in SwingFi's entry area, how close it is to target or stop, and whether fresh headlines changed the setup.",
    "Risk reminder: SwingFi is research software. It does not place trades, guarantee outcomes, or replace your own risk review.",
  ].filter(Boolean).join("\n");
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
  const tickerEvidence = await buildTickerEvidence({
    message,
    openTrades,
    opportunities,
  });
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
    trackedPortfolio: openTrades.map((trade) =>
      summarizeTrade(trade, findOpportunityForTrade(trade, opportunities)),
    ),
    tickerEvidence,
    predictionOutcomes: summarizeOutcomes(outcomes),
    decisionRulesForAssistant: [
      "If the user asks whether to buy, buy more, purchase more, add shares, average up, or average down, do not answer yes or no.",
      "Instead classify each mentioned ticker as: worth reviewing, caution, or insufficient live evidence. Prefer the tickerEvidence.addExposureRead classification when present.",
      "Do not say insufficient evidence if tickerEvidence has a portfolioPlan, currentPrice, recentTechnicals, or latestHeadlines. Say what evidence is present and what is missing.",
      "Use the saved plan and latest ticker evidence: current price vs entry range, distance to target, distance to stop, score, confidence, risk score, days left, recent price trend, events, and headline tone.",
      "If price is above the model entry range, explain that adding may be chasing unless the user creates a new plan.",
      "If price is near target, explain that the question is profit/risk review, not adding exposure.",
      "If price is near or below stop, explain that the original risk line is under pressure.",
      "If the ticker is not in today's ranked opportunities but has portfolio or on-demand evidence, say SwingFi can still review the existing position but does not have a fresh top-ranked add-more setup.",
      "For multi-ticker questions, compare the tickers directly and name which one has the cleaner research setup, which one is caution, or if neither is clean.",
    ],
  };

  if (!hasOpenAiApiKey()) {
    return NextResponse.json({
      answer: fallbackAnswer({ message, opportunities, openTrades, tickerEvidence }),
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
          "You are Ask SwingFi, a research assistant for beginner to intermediate swing traders. You answer using only the provided SwingFi context: latest ranked opportunities, on-demand ticker evidence, data freshness, prediction outcomes, and the user's tracked portfolio. Be direct, practical, plain-English, and data-specific. No fluff, no generic market advice, no motivational filler. Every answer should reference concrete symbols, scores, entry ranges, targets, stops, current portfolio prices, distance-to-target/stop, days held/left, recent price trend, headline/event context, or clearly say what data is missing. Do not claim certainty, do not promise returns, do not say buy, sell, must, guaranteed, sure thing, or best stock to buy. Do not recommend changing stops, changing position size, or placing orders. When a user asks if it is a good idea to buy more, purchase more, or add to a position, classify each mentioned ticker as worth reviewing, caution, or insufficient live evidence using tickerEvidence.addExposureRead first. Do not say insufficient evidence when SwingFi has a saved portfolio plan, current quote, recent candles, or headlines. In that case, answer with the evidence we do have and the missing data separately. Use phrases like review, compare, check, watch, and confirm in your brokerage. SwingFi is research software, not financial advice and not a broker.",
      },
      {
        role: "user",
        content: JSON.stringify({
          userQuestion: message,
          responseInstructions:
            "Answer with no numbered list. Start with 'Bottom line:' and give a direct comparison or classification in 1-2 short sentences, without using buy/sell commands. Then include short bullets under these exact labels: 'Why:', 'Ticker reads:', 'What would change it:', and 'Next check:'. Use one bullet per mentioned ticker with exact numbers from tickerEvidence, portfolioPlan, or ranked setup. Explain whether adding would be near the plan, chasing, near target, near stop, or simply not a fresh top-ranked setup. Avoid vague phrases like 'insufficient evidence' unless there is no current quote, no plan, no candles, and no headlines. Do not invent live prices, revenue, financials, external headlines, or news not shown in context. End with one brief risk reminder that SwingFi is research software, not a broker or financial adviser.",
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
    answer: normalizeAssistantAnswer(response.text),
    mode: response.mode,
    suggestions: [
      "Would adding to any portfolio position be chasing right now?",
      "Which holding is closest to its target or stop?",
      "Which ranked setup has the cleanest risk/reward for a beginner?",
    ],
  });
}

import type { OpportunityRow } from "@/lib/database.types";
import { estimateDailyAgentCost } from "./costs";
import { getMockEquityUniverse } from "./mock-equity-universe";
import type {
  AgentDataSource,
  AgentRunResult,
  EquityCandidate,
  RankedEquityOpportunity,
  ScoreBreakdown,
} from "./types";

type RunOptions = {
  asOf?: Date;
  limit?: number;
};

type RankOptions = RunOptions & {
  source?: AgentDataSource;
  dataQuality?: AgentRunResult["dataQuality"];
  summaryPrefix?: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toScore(value: number, min: number, max: number) {
  return clamp(((value - min) / (max - min)) * 100);
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hash(value: string) {
  return Array.from(value).reduce((total, char, index) => {
    return total + char.charCodeAt(0) * (index + 17);
  }, 0);
}

function mockUuid(namespace: string, key: string) {
  const source = `${namespace}:${key}`;
  let hex = "";

  for (let index = 0; hex.length < 32; index += 1) {
    hex += Math.abs(hash(`${source}:${index}`)).toString(16).padStart(8, "0");
  }

  const value = hex.slice(0, 32).split("");
  value[12] = "4";
  value[16] = ((parseInt(value[16], 16) & 0x3) | 0x8).toString(16);

  return `${value.slice(0, 8).join("")}-${value.slice(8, 12).join("")}-${value
    .slice(12, 16)
    .join("")}-${value.slice(16, 20).join("")}-${value.slice(20, 32).join("")}`;
}

function scoreTechnical(candidate: EquityCandidate) {
  const { technical } = candidate;
  const movingAverageStack =
    (technical.price > technical.sma20 ? 18 : 4) +
    (technical.sma20 > technical.sma50 ? 16 : 5) +
    (technical.sma50 > technical.sma200 ? 16 : 6);
  const rsiScore = technical.rsi14 >= 48 && technical.rsi14 <= 66 ? 16 : 8;
  const relativeStrength = toScore(technical.relativeStrength90d, 35, 95) * 0.25;
  const volume = toScore(technical.volumeTrend, -10, 30) * 0.15;

  return clamp(movingAverageStack + rsiScore + relativeStrength + volume);
}

function scoreFinancials(candidate: EquityCandidate) {
  const { financials } = candidate;

  return clamp(
    toScore(financials.revenueGrowth, -5, 30) * 0.24 +
      toScore(financials.earningsGrowth, -10, 40) * 0.24 +
      toScore(financials.freeCashFlowYield, 0, 8) * 0.14 +
      (100 - toScore(financials.debtToEquity, 0, 3)) * 0.12 +
      toScore(financials.marginTrend, -6, 12) * 0.12 +
      financials.revisionScore * 0.08 +
      financials.valuationScore * 0.06,
  );
}

function scoreNews(candidate: EquityCandidate) {
  const { news } = candidate;

  return clamp(
    news.sentimentScore * 0.42 +
      news.catalystScore * 0.38 +
      toScore(news.headlineCount, 1, 24) * 0.1 -
      news.riskFlagCount * 7,
  );
}

function scoreMacro(candidate: EquityCandidate) {
  const { market } = candidate;

  return clamp(
    market.marketRegimeScore * 0.3 +
      market.sectorTrendScore * 0.28 +
      market.breadthScore * 0.18 +
      market.economicSurpriseScore * 0.14 +
      (100 - market.ratesPressureScore) * 0.1,
  );
}

function scoreLiquidity(candidate: EquityCandidate) {
  const volumeScore = toScore(candidate.averageVolume, 1000000, 70000000);
  const capScore = toScore(candidate.marketCapBillions, 20, 900);
  return clamp(volumeScore * 0.55 + capScore * 0.45);
}

function scoreRisk(candidate: EquityCandidate) {
  const { technical, financials, news } = candidate;
  const volatilityRisk = toScore(technical.atrPercent, 1.5, 8.5) * 0.4;
  const supportDistanceRisk =
    toScore(((technical.price - technical.support) / technical.price) * 100, 2, 10) * 0.24;
  const balanceSheetRisk = toScore(financials.debtToEquity, 0, 3) * 0.14;
  const newsRisk = clamp(news.riskFlagCount * 14) * 0.14;
  const rsiRisk = technical.rsi14 > 68 ? 12 : technical.rsi14 < 44 ? 8 : 3;

  return clamp(volatilityRisk + supportDistanceRisk + balanceSheetRisk + newsRisk + rsiRisk);
}

function scoreConfidence(scores: Omit<ScoreBreakdown, "confidence" | "composite">) {
  const values = [
    scores.technical,
    scores.financial,
    scores.news,
    scores.macro,
    scores.liquidity,
  ];
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const dispersion =
    values.reduce((total, value) => total + Math.abs(value - average), 0) / values.length;
  const agreement = 100 - dispersion;
  const riskAdjustment = 100 - scores.risk * 0.45;

  return Math.round(clamp(agreement * 0.58 + riskAdjustment * 0.32 + average * 0.1));
}

function getMarketRegime(candidates: EquityCandidate[]) {
  if (candidates.length === 0) {
    return "balanced";
  }

  const average =
    candidates.reduce((total, candidate) => total + candidate.market.marketRegimeScore, 0) /
    candidates.length;

  if (average >= 68) return "risk-on";
  if (average <= 55) return "defensive";
  return "balanced";
}

function buildReasons(candidate: EquityCandidate, scores: ScoreBreakdown) {
  const reasons = [
    `Technical setup scores ${scores.technical}/100 with price near ${round(candidate.technical.price, 2)} and 90-day relative strength at ${candidate.technical.relativeStrength90d}.`,
    `Financial quality scores ${scores.financial}/100, supported by ${candidate.financials.revenueGrowth}% revenue growth and ${candidate.financials.earningsGrowth}% earnings growth.`,
    `News and catalyst tone scores ${scores.news}/100 with ${candidate.news.headlineCount} tracked headlines and ${candidate.news.riskFlagCount} risk flags.`,
    `Macro backdrop scores ${scores.macro}/100 for ${candidate.sector}, using market breadth, rates pressure, and government-data placeholders.`,
  ];

  if (scores.risk >= 60) {
    reasons.push("Risk is elevated, so the model requires cleaner entry discipline and smaller sizing.");
  } else if (scores.risk <= 35) {
    reasons.push("Risk is comparatively mild because volatility and support distance are controlled.");
  }

  return reasons;
}

function buildOpportunity(
  candidate: EquityCandidate,
  scores: ScoreBreakdown,
  asOf: Date,
  source: AgentDataSource,
) {
  const { technical } = candidate;
  const entryLow = Math.max(technical.support * 1.005, technical.price * 0.985);
  const entryHigh = technical.price * 1.012;
  const targetPrice = Math.min(technical.resistance * 0.99, entryLow * 1.18);
  const stopLoss = technical.support * 0.985;
  const expectedGain = ((targetPrice - entryLow) / entryLow) * 100;
  const expectedLoss = ((entryLow - stopLoss) / entryLow) * 100;
  const holdingPeriodDays = Math.round(clamp(8 + (scores.risk / 100) * 18, 8, 28));
  const explanation = [
    `${candidate.symbol} ranks highly because trend, fundamentals, news tone, and macro context are aligned better than most names in the ${source === "fmp" ? "live FMP-screened universe" : "mock universe"}.`,
    ...buildReasons(candidate, scores).slice(0, 3),
    source === "fmp"
      ? "This analysis uses live market/fundamental inputs where available, but it still requires backtesting and forward outcome tracking before it should be treated as verified."
      : "This is mock analysis only; live execution should wait for real market data, filings, news, and risk checks.",
  ].join(" ");

  return {
    id: mockUuid("opportunity", `${asOf.toISOString().slice(0, 10)}:${candidate.symbol}`),
    symbol: candidate.symbol,
    asset_type: "stock" as const,
    score: scores.composite,
    confidence: scores.confidence,
    risk_score: scores.risk,
    entry_low: round(entryLow, 2),
    entry_high: round(entryHigh, 2),
    target_price: round(targetPrice, 2),
    stop_loss: round(stopLoss, 2),
    expected_gain: round(Math.max(expectedGain, 0), 1),
    expected_loss: round(Math.max(expectedLoss, 0), 1),
    holding_period_days: holdingPeriodDays,
    explanation,
    created_at: asOf.toISOString(),
  } satisfies OpportunityRow;
}

function scoreCandidate(candidate: EquityCandidate): ScoreBreakdown {
  const partial = {
    technical: Math.round(scoreTechnical(candidate)),
    financial: Math.round(scoreFinancials(candidate)),
    news: Math.round(scoreNews(candidate)),
    macro: Math.round(scoreMacro(candidate)),
    liquidity: Math.round(scoreLiquidity(candidate)),
    risk: Math.round(scoreRisk(candidate)),
  };
  const confidence = scoreConfidence(partial);
  const composite = Math.round(
    clamp(
      partial.technical * 0.36 +
        partial.financial * 0.23 +
        partial.news * 0.16 +
        partial.macro * 0.13 +
        partial.liquidity * 0.07 +
        (100 - partial.risk) * 0.05,
    ),
  );

  return { ...partial, confidence, composite };
}

export function runDailyRankingAgent({
  asOf = new Date(),
  limit = 30,
}: RunOptions = {}): AgentRunResult {
  const universe = getMockEquityUniverse(asOf);
  return rankEquityCandidates(universe, {
    asOf,
    limit,
    source: "mock",
    dataQuality: {
      priceData: "mock",
      financialData: "mock",
      macroData: "mock",
      newsData: "mock",
      eventData: "mock",
      secData: "mock",
      notes: [
        "Mock provider mode is active. No external market-data provider was called.",
        "Use /api/agent/daily-rankings?source=fmp after adding FMP_API_KEY to run with live FMP inputs.",
      ],
    },
    summaryPrefix: "Mock morning agent",
  });
}

export function rankEquityCandidates(
  universe: EquityCandidate[],
  {
    asOf = new Date(),
    limit = 30,
    source = "mock",
    dataQuality = {
      priceData: "mock",
      financialData: "mock",
      macroData: "mock",
      newsData: "mock",
      eventData: "mock",
      secData: "mock",
      notes: ["Mock provider mode is active."],
    },
    summaryPrefix,
  }: RankOptions = {},
): AgentRunResult {
  const marketRegime = getMarketRegime(universe);
  const runId = mockUuid(`${source}-agent-run`, asOf.toISOString().slice(0, 10));
  const ranked = universe
    .map((candidate) => {
      const scores = scoreCandidate(candidate);
      const opportunity = buildOpportunity(candidate, scores, asOf, source);

      return {
        candidate,
        opportunity,
        scores,
        reasons: buildReasons(candidate, scores),
      };
    })
    .sort((a, b) => b.scores.composite - a.scores.composite)
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    })) satisfies RankedEquityOpportunity[];

  return {
    runId,
    asOf: asOf.toISOString(),
    dataSource: source,
    dataQuality,
    universeCount: universe.length,
    selectedCount: ranked.length,
    marketRegime,
    summary: `${summaryPrefix ?? "Morning agent"} ranked ${universe.length} US stocks and selected the top ${ranked.length} using technicals, company financials, news/catalyst tone, macro/government data placeholders, liquidity, and risk.`,
    costEstimate: estimateDailyAgentCost({ selectedCount: ranked.length }),
    opportunities: ranked.map((item) => item.opportunity),
    rankings: ranked,
  };
}

export function createDailyMockOpportunityRows(asOf: Date = new Date()) {
  return runDailyRankingAgent({ asOf, limit: 30 }).opportunities;
}

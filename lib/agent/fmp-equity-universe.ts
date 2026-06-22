import {
  getFmpCompanyProfile,
  getFmpEarnings,
  getFmpHistoricalCandles,
  getFmpIncomeStatements,
  getFmpKeyMetricsTtm,
  getFmpRatiosTtm,
  getFmpSecFilingsBySymbol,
  getFmpStockNews,
  type FmpEarningsEvent,
  hasFmpCredentials,
  type FmpHistoricalCandle,
  type FmpIncomeStatement,
  type FmpSecFiling,
  type FmpStockNews,
} from "@/lib/providers/fmp";
import { getBlsMacroContext, type BlsMacroContext } from "@/lib/providers/bls";
import { getFredMacroContext, type FredMacroContext } from "@/lib/providers/fred";
import { getMockEquityUniverse } from "./mock-equity-universe";
import { rankEquityCandidates } from "./ranking-agent";
import type { AgentRunResult, CompanyFinancialSnapshot, EquityCandidate, Sector } from "./types";

const defaultSymbols = [
  "NVDA",
  "MSFT",
  "AAPL",
  "AMZN",
  "META",
  "GOOGL",
  "AVGO",
  "AMD",
  "TSLA",
  "LLY",
  "UNH",
  "JPM",
  "V",
  "MA",
  "COST",
  "WMT",
  "HD",
  "NFLX",
  "ADBE",
  "CRM",
  "NOW",
  "ORCL",
  "PANW",
  "CRWD",
  "CAT",
  "GE",
  "BA",
  "XOM",
  "CVX",
  "COP",
  "FCX",
  "LIN",
  "NEE",
  "PLD",
  "SBUX",
  "MCD",
  "TMO",
  "ISRG",
  "PGR",
  "UBER",
];

type RunFmpOptions = {
  asOf?: Date;
  limit?: number;
  symbols?: string[];
};

type CandidateBuildResult = {
  candidate: EquityCandidate;
  hasLivePriceData: boolean;
  hasLiveFinancialData: boolean;
  hasLiveNewsData: boolean;
  hasLiveEventData: boolean;
  hasLiveSecData: boolean;
};

type CombinedMacroContext = FredMacroContext & {
  bls: BlsMacroContext;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function daysAgo(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next.toISOString().slice(0, 10);
}

function daysAhead(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function containsAny(value: string, keywords: string[]) {
  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function normalizePercent(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  const next = Number(value);
  return Math.abs(next) <= 1 ? next * 100 : next;
}

function mapSector(value: string | undefined): Sector {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("communication")) return "Communication Services";
  if (normalized.includes("consumer defensive") || normalized.includes("staples")) {
    return "Consumer Staples";
  }
  if (normalized.includes("consumer")) return "Consumer Discretionary";
  if (normalized.includes("energy")) return "Energy";
  if (normalized.includes("financial")) return "Financials";
  if (normalized.includes("health")) return "Health Care";
  if (normalized.includes("industrial")) return "Industrials";
  if (normalized.includes("technology")) return "Information Technology";
  if (normalized.includes("material")) return "Materials";
  if (normalized.includes("real estate")) return "Real Estate";
  if (normalized.includes("utilit")) return "Utilities";

  return "Information Technology";
}

function sectorMacroBias(sector: Sector) {
  const biases: Record<Sector, number> = {
    "Communication Services": 4,
    "Consumer Discretionary": 0,
    "Consumer Staples": 4,
    Energy: -1,
    Financials: 2,
    "Health Care": 4,
    Industrials: 3,
    "Information Technology": 7,
    Materials: 1,
    "Real Estate": -3,
    Utilities: 0,
  };

  return biases[sector];
}

function validCandle(candle: FmpHistoricalCandle) {
  return (
    typeof candle.date === "string" &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.volume)
  );
}

function sortCandles(candles: FmpHistoricalCandle[]) {
  return candles
    .filter(validCandle)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function calculateRsi(closes: number[], lookback = 14) {
  if (closes.length <= lookback) return 50;

  const changes = closes.slice(-lookback - 1).map((close, index, values) => {
    if (index === 0) return 0;
    return close - values[index - 1];
  });
  const gains = changes.slice(1).map((change) => Math.max(change, 0));
  const losses = changes.slice(1).map((change) => Math.abs(Math.min(change, 0)));
  const averageGain = average(gains);
  const averageLoss = average(losses);

  if (averageLoss === 0) return 70;

  const relativeStrength = averageGain / averageLoss;
  return clamp(100 - 100 / (1 + relativeStrength), 0, 100);
}

function calculateAtrPercent(candles: FmpHistoricalCandle[], price: number, lookback = 14) {
  if (candles.length <= lookback || price <= 0) return 3.5;

  const recent = candles.slice(-lookback - 1);
  const trueRanges = recent.slice(1).map((candle, index) => {
    const previousClose = recent[index].close ?? price;
    return Math.max(
      (candle.high ?? price) - (candle.low ?? price),
      Math.abs((candle.high ?? price) - previousClose),
      Math.abs((candle.low ?? price) - previousClose),
    );
  });

  return (average(trueRanges) / price) * 100;
}

function buildTechnicalSnapshot(candles: FmpHistoricalCandle[]) {
  const sorted = sortCandles(candles);

  if (sorted.length < 210) {
    return null;
  }

  const closes = sorted.map((candle) => candle.close ?? 0);
  const volumes = sorted.map((candle) => candle.volume ?? 0);
  const latest = sorted[sorted.length - 1];
  const price = latest.close ?? 0;
  const close90DaysAgo = closes[Math.max(0, closes.length - 91)];
  const relativeStrength90d = clamp(50 + percentChange(price, close90DaysAgo) * 1.8, 25, 100);
  const recent20 = sorted.slice(-20);
  const recent40 = sorted.slice(-40);
  const volume20 = average(volumes.slice(-20));
  const volume50Previous = average(volumes.slice(-70, -20));

  return {
    price: round(price, 2),
    sma20: round(average(closes.slice(-20)), 2),
    sma50: round(average(closes.slice(-50)), 2),
    sma200: round(average(closes.slice(-200)), 2),
    rsi14: round(calculateRsi(closes), 1),
    atrPercent: round(calculateAtrPercent(sorted, price), 1),
    relativeStrength90d: Math.round(relativeStrength90d),
    support: round(Math.min(...recent20.map((candle) => candle.low ?? price)), 2),
    resistance: round(Math.max(...recent40.map((candle) => candle.high ?? price)), 2),
    volumeTrend: round(percentChange(volume20, volume50Previous), 1),
  };
}

function statementGrowth(
  statements: FmpIncomeStatement[],
  field: keyof Pick<FmpIncomeStatement, "revenue" | "netIncome">,
) {
  const sorted = [...statements]
    .filter((statement) => Number.isFinite(statement[field]))
    .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime());

  if (sorted.length < 2) return 0;

  return percentChange(Number(sorted[0][field]), Number(sorted[1][field]));
}

function marginTrend(statements: FmpIncomeStatement[]) {
  const sorted = [...statements]
    .filter((statement) => Number.isFinite(statement.grossProfitRatio))
    .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime());

  if (sorted.length < 2) return 0;

  return normalizePercent(sorted[0].grossProfitRatio) - normalizePercent(sorted[1].grossProfitRatio);
}

function buildFinancialSnapshot(args: {
  incomeStatements: FmpIncomeStatement[];
  debtToEquity?: number;
  freeCashFlowYield?: number;
  peRatio?: number;
  priceToSalesRatio?: number;
  fallback: CompanyFinancialSnapshot;
}) {
  if (args.incomeStatements.length < 2) {
    return {
      financials: args.fallback,
      isLive: false,
    };
  }

  const revenueGrowth = round(statementGrowth(args.incomeStatements, "revenue"), 1);
  const earningsGrowth = round(statementGrowth(args.incomeStatements, "netIncome"), 1);
  const freeCashFlowYield = round(normalizePercent(args.freeCashFlowYield), 1);
  const debtToEquity = round(Number.isFinite(args.debtToEquity) ? Number(args.debtToEquity) : args.fallback.debtToEquity, 2);
  const peRatio = Number.isFinite(args.peRatio) ? Number(args.peRatio) : 24;
  const priceToSalesRatio = Number.isFinite(args.priceToSalesRatio)
    ? Number(args.priceToSalesRatio)
    : 5;
  const valuationScore = clamp(100 - peRatio * 1.6 - priceToSalesRatio * 2.2, 20, 90);

  return {
    financials: {
      revenueGrowth,
      earningsGrowth,
      freeCashFlowYield: freeCashFlowYield || args.fallback.freeCashFlowYield,
      debtToEquity,
      marginTrend: round(marginTrend(args.incomeStatements), 1),
      revisionScore: Math.round(clamp(54 + revenueGrowth * 0.7 + earningsGrowth * 0.35, 25, 90)),
      valuationScore: Math.round(valuationScore),
    },
    isLive: true,
  };
}

function buildNewsAndCatalystSnapshot(args: {
  symbol: string;
  asOf: Date;
  news: FmpStockNews[];
  earnings: FmpEarningsEvent[];
  filings: FmpSecFiling[];
}) {
  const positiveKeywords = [
    "beat",
    "beats",
    "raise",
    "raises",
    "raised",
    "upgrade",
    "upgraded",
    "approval",
    "approved",
    "partnership",
    "launch",
    "record",
    "growth",
    "expands",
    "contract",
    "guidance",
  ];
  const negativeKeywords = [
    "miss",
    "misses",
    "downgrade",
    "downgraded",
    "lawsuit",
    "investigation",
    "probe",
    "recall",
    "breach",
    "hack",
    "cut",
    "cuts",
    "warns",
    "warning",
    "bankruptcy",
    "subpoena",
  ];
  const riskyForms = new Set(["8-K", "S-1", "S-3", "424B5", "NT 10-K", "NT 10-Q"]);
  const recentNews = args.news.filter((item) => {
    if (!item.publishedDate) return false;
    return Math.abs(daysBetween(new Date(item.publishedDate), args.asOf)) <= 14;
  });
  const positiveCount = recentNews.filter((item) =>
    containsAny(`${item.title ?? ""} ${item.text ?? ""}`, positiveKeywords),
  ).length;
  const negativeCount = recentNews.filter((item) =>
    containsAny(`${item.title ?? ""} ${item.text ?? ""}`, negativeKeywords),
  ).length;
  const sortedEarnings = [...args.earnings]
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date ?? "").getTime() - new Date(b.date ?? "").getTime());
  const nextEarnings = sortedEarnings.find(
    (item) => daysBetween(args.asOf, new Date(item.date ?? "")) >= 0,
  );
  const priorEarnings = [...sortedEarnings]
    .reverse()
    .find((item) => daysBetween(new Date(item.date ?? ""), args.asOf) >= 0);
  const daysToEarnings = nextEarnings?.date
    ? daysBetween(args.asOf, new Date(nextEarnings.date))
    : null;
  const epsSurprise =
    priorEarnings?.epsActual !== null &&
    priorEarnings?.epsActual !== undefined &&
    priorEarnings?.epsEstimated
      ? ((priorEarnings.epsActual - priorEarnings.epsEstimated) /
          Math.abs(priorEarnings.epsEstimated)) *
        100
      : 0;
  const recentFilings = args.filings.filter((filing) => {
    if (!filing.filingDate) return false;
    return daysBetween(new Date(filing.filingDate), args.asOf) <= 30;
  });
  const riskFilingCount = recentFilings.filter((filing) =>
    riskyForms.has(filing.formType ?? ""),
  ).length;
  const earningsRisk = daysToEarnings !== null && daysToEarnings <= 7 ? 2 : daysToEarnings !== null && daysToEarnings <= 14 ? 1 : 0;
  const riskFlagCount = Math.max(0, negativeCount + riskFilingCount + earningsRisk);
  const sentimentScore = clamp(55 + positiveCount * 8 - negativeCount * 11 + Math.min(recentNews.length, 8) * 1.5);
  const catalystScore = clamp(
    48 +
      positiveCount * 9 +
      Math.max(0, epsSurprise) * 0.35 +
      (daysToEarnings !== null && daysToEarnings <= 21 ? 5 : 0) -
      negativeCount * 8 -
      riskFilingCount * 5,
  );
  const summaryParts = [
    `${args.symbol} has ${recentNews.length} recent FMP news item${recentNews.length === 1 ? "" : "s"}`,
    `${positiveCount} positive catalyst signal${positiveCount === 1 ? "" : "s"}`,
    `${negativeCount} negative risk signal${negativeCount === 1 ? "" : "s"}`,
  ];

  if (daysToEarnings !== null) {
    summaryParts.push(`next earnings in ${daysToEarnings} day${daysToEarnings === 1 ? "" : "s"}`);
  }

  if (recentFilings.length > 0) {
    summaryParts.push(
      `${recentFilings.length} recent SEC filing${recentFilings.length === 1 ? "" : "s"}`,
    );
  }

  return {
    snapshot: {
      sentimentScore: Math.round(sentimentScore),
      catalystScore: Math.round(catalystScore),
      headlineCount: recentNews.length,
      riskFlagCount,
      summary: `${summaryParts.join(", ")}.`,
    },
    hasLiveNewsData: args.news.length > 0,
    hasLiveEventData: args.earnings.length > 0,
    hasLiveSecData: args.filings.length > 0,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

function combineMacroContexts(fred: FredMacroContext, bls: BlsMacroContext) {
  const economicSurpriseScore = clamp(
    fred.economicSurpriseScore + bls.economicSurpriseAdjustment,
    20,
    90,
  );
  const ratesPressureScore = clamp(
    fred.ratesPressureScore + bls.ratesPressureAdjustment,
    20,
    95,
  );
  const marketRegimeScore = clamp(
    fred.marketRegimeScore +
      bls.economicSurpriseAdjustment * 0.28 -
      bls.ratesPressureAdjustment * 0.22,
    20,
    90,
  );

  return {
    ...fred,
    bls,
    isLive: fred.isLive || bls.isLive,
    marketRegimeScore: Math.round(marketRegimeScore),
    economicSurpriseScore: Math.round(economicSurpriseScore),
    ratesPressureScore: Math.round(ratesPressureScore),
    summary: `${fred.summary} ${bls.summary}`,
    notes: [...fred.notes, ...bls.notes],
  } satisfies CombinedMacroContext;
}

function buildMarketSnapshot(sector: Sector, macro: CombinedMacroContext) {
  return {
    marketRegimeScore: macro.marketRegimeScore,
    sectorTrendScore: Math.round(clamp(58 + sectorMacroBias(sector) + (macro.breadthScore - 58) * 0.2)),
    economicSurpriseScore: macro.economicSurpriseScore,
    ratesPressureScore: macro.ratesPressureScore,
    breadthScore: macro.breadthScore,
    govDataSummary: macro.summary,
  };
}

async function buildFmpCandidate(
  symbol: string,
  asOf: Date,
  macro: CombinedMacroContext,
  fallback: EquityCandidate,
) {
  const from = daysAgo(asOf, 430);
  const to = asOf.toISOString().slice(0, 10);
  const secFrom = daysAgo(asOf, 45);
  const earningsTo = daysAhead(asOf, 90);

  const [
    candles,
    profile,
    incomeStatements,
    ratios,
    keyMetrics,
    news,
    earnings,
    secFilings,
  ] = await Promise.all([
    getFmpHistoricalCandles(symbol, from, to),
    getFmpCompanyProfile(symbol),
    getFmpIncomeStatements(symbol, 4),
    getFmpRatiosTtm(symbol),
    getFmpKeyMetricsTtm(symbol),
    getFmpStockNews(symbol, 10),
    getFmpEarnings(symbol, 8),
    getFmpSecFilingsBySymbol(symbol, secFrom, earningsTo, 12),
  ]);
  const technical = buildTechnicalSnapshot(candles);

  if (!technical) {
    return null;
  }

  const sector = mapSector(profile?.sector ?? fallback.sector);
  const averageVolume = profile?.volAvg ?? profile?.avgVolume ?? fallback.averageVolume ?? candles.at(-1)?.volume ?? 0;
  const marketCapBillions = Math.max(0, (profile?.marketCap ?? fallback.marketCapBillions * 1_000_000_000) / 1_000_000_000);
  const financialResult = buildFinancialSnapshot({
    incomeStatements,
    debtToEquity: ratios?.debtEquityRatioTTM,
    freeCashFlowYield: keyMetrics?.freeCashFlowYieldTTM,
    peRatio: ratios?.priceEarningsRatioTTM ?? keyMetrics?.peRatioTTM,
    priceToSalesRatio: ratios?.priceToSalesRatioTTM,
    fallback: fallback.financials,
  });
  const newsResult = buildNewsAndCatalystSnapshot({
    symbol,
    asOf,
    news,
    earnings,
    filings: secFilings,
  });

  return {
    candidate: {
      symbol,
      companyName: profile?.companyName ?? profile?.companyNameLong ?? fallback.companyName,
      sector,
      averageVolume,
      marketCapBillions,
      technical,
      financials: financialResult.financials,
      news: newsResult.snapshot,
      market: {
        ...buildMarketSnapshot(sector, macro),
      },
    },
    hasLiveFinancialData: financialResult.isLive,
    hasLiveNewsData: newsResult.hasLiveNewsData,
    hasLiveEventData: newsResult.hasLiveEventData,
    hasLiveSecData: newsResult.hasLiveSecData,
  };
}

function buildFallbackCandidate(fallback: EquityCandidate, macro: CombinedMacroContext) {
  return {
    ...fallback,
    news: {
      sentimentScore: 55,
      catalystScore: 52,
      headlineCount: 0,
      riskFlagCount: 0,
      summary:
        "Live news and catalyst scoring is not connected yet; this run uses a neutral placeholder.",
    },
    market: {
      ...buildMarketSnapshot(fallback.sector, macro),
    },
  } satisfies EquityCandidate;
}

export async function getFmpEquityUniverse(
  asOf: Date,
  macro: CombinedMacroContext,
  symbols = defaultSymbols,
) {
  if (!hasFmpCredentials()) {
    throw new Error("FMP_API_KEY is not configured.");
  }

  const fallbackBySymbol = new Map(
    getMockEquityUniverse(asOf).map((candidate) => [candidate.symbol, candidate]),
  );
  const results = await mapWithConcurrency<string, CandidateBuildResult | null>(symbols, 2, async (symbol) => {
    const fallback = fallbackBySymbol.get(symbol);

    if (!fallback) {
      return null;
    }

    try {
      const candidate = await buildFmpCandidate(symbol, asOf, macro, fallback);

      if (candidate) {
        return {
          candidate: candidate.candidate,
          hasLivePriceData: true,
          hasLiveFinancialData: candidate.hasLiveFinancialData,
          hasLiveNewsData: candidate.hasLiveNewsData,
          hasLiveEventData: candidate.hasLiveEventData,
          hasLiveSecData: candidate.hasLiveSecData,
        } satisfies CandidateBuildResult;
      }
    } catch {
      return {
        candidate: buildFallbackCandidate(fallback, macro),
        hasLivePriceData: false,
        hasLiveFinancialData: false,
        hasLiveNewsData: false,
        hasLiveEventData: false,
        hasLiveSecData: false,
      } satisfies CandidateBuildResult;
    }

    return {
      candidate: buildFallbackCandidate(fallback, macro),
      hasLivePriceData: false,
      hasLiveFinancialData: false,
      hasLiveNewsData: false,
      hasLiveEventData: false,
      hasLiveSecData: false,
    } satisfies CandidateBuildResult;
  });

  const builtCandidates = results.filter((result) => result !== null);

  return {
    candidates: builtCandidates.map((result) => result.candidate),
    livePriceCount: builtCandidates.filter((result) => result.hasLivePriceData).length,
    liveFinancialCount: builtCandidates.filter((result) => result.hasLiveFinancialData).length,
    liveNewsCount: builtCandidates.filter((result) => result.hasLiveNewsData).length,
    liveEventCount: builtCandidates.filter((result) => result.hasLiveEventData).length,
    liveSecCount: builtCandidates.filter((result) => result.hasLiveSecData).length,
  };
}

export async function runFmpDailyRankingAgent({
  asOf = new Date(),
  limit = 30,
  symbols = defaultSymbols,
}: RunFmpOptions = {}): Promise<AgentRunResult> {
  const macro = await getFredMacroContext();
  const bls = await getBlsMacroContext();
  const combinedMacro = combineMacroContexts(macro, bls);
  const universeResult = await getFmpEquityUniverse(asOf, combinedMacro, symbols);
  const universe = universeResult.candidates;
  const skippedCount = symbols.length - universe.length;
  const livePriceCount = universeResult.livePriceCount;
  const liveFinancialCount = universeResult.liveFinancialCount;
  const liveNewsCount = universeResult.liveNewsCount;
  const liveEventCount = universeResult.liveEventCount;
  const liveSecCount = universeResult.liveSecCount;

  return rankEquityCandidates(universe, {
    asOf,
    limit,
    source: "fmp",
    dataQuality: {
      priceData:
        livePriceCount === universe.length ? "live" : livePriceCount > 0 ? "partial" : "mock",
      financialData:
        liveFinancialCount === universe.length
          ? "live"
          : liveFinancialCount > 0
            ? "partial"
            : "mock",
      macroData: combinedMacro.isLive ? "live" : "partial",
      newsData:
        liveNewsCount === universe.length ? "live" : liveNewsCount > 0 ? "partial" : "mock",
      eventData:
        liveEventCount === universe.length ? "live" : liveEventCount > 0 ? "partial" : "mock",
      secData: liveSecCount === universe.length ? "live" : liveSecCount > 0 ? "partial" : "mock",
      notes: [
        "Live FMP daily candles are used for technical scoring. FMP profiles, statements, ratios, and key metrics are used for financial scoring when available.",
        `${livePriceCount} of ${universe.length} ranked symbols used live FMP price candles in this run.`,
        `${liveFinancialCount} of ${universe.length} ranked symbols used live FMP fundamental data in this run.`,
        `${liveNewsCount} of ${universe.length} ranked symbols used live FMP stock news for catalyst scoring.`,
        `${liveEventCount} of ${universe.length} ranked symbols used live FMP earnings/corporate event data.`,
        `${liveSecCount} of ${universe.length} ranked symbols used live FMP SEC filing checks.`,
        combinedMacro.isLive
          ? "Live government macro data is connected through FRED and/or BLS."
          : "Government macro data fell back to a neutral placeholder for this run.",
        ...combinedMacro.notes,
        skippedCount > 0
          ? `${skippedCount} symbols were skipped because no starter fallback was available.`
          : livePriceCount === universe.length
            ? "All requested symbols were ranked with live FMP price candles."
            : "All requested symbols were ranked; symbols without live FMP candles used starter technical fallbacks.",
      ],
    },
    summaryPrefix: "FMP-backed morning agent",
  });
}

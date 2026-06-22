import {
  getFmpHistoricalCandles,
  hasFmpCredentials,
  type FmpHistoricalCandle,
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
  "UNH",
  "JPM",
  "V",
  "COST",
  "WMT",
  "NFLX",
  "ADBE",
  "GE",
  "BA",
  "XOM",
  "CVX",
  "SBUX",
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

  const candles = await getFmpHistoricalCandles(symbol, from, to);
  const technical = buildTechnicalSnapshot(candles);

  if (!technical) {
    return null;
  }

  const sector = mapSector(fallback.sector);
  const averageVolume = fallback.averageVolume || candles.at(-1)?.volume || 0;
  const financials: CompanyFinancialSnapshot = fallback.financials;

  return {
    symbol,
    companyName: fallback.companyName,
    sector,
    averageVolume,
    marketCapBillions: fallback.marketCapBillions,
    technical,
    financials,
    news: {
      sentimentScore: 55,
      catalystScore: 52,
      headlineCount: 0,
      riskFlagCount: 0,
      summary:
        "Live news and catalyst scoring is not connected yet; this run uses a neutral placeholder so technical and fundamental data drive the ranking.",
    },
    market: {
      ...buildMarketSnapshot(sector, macro),
    },
  } satisfies EquityCandidate;
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
  const results = await mapWithConcurrency(symbols, 2, async (symbol) => {
    const fallback = fallbackBySymbol.get(symbol);

    if (!fallback) {
      return null;
    }

    try {
      const candidate = await buildFmpCandidate(symbol, asOf, macro, fallback);

      if (candidate) {
        return { candidate, hasLivePriceData: true } satisfies CandidateBuildResult;
      }
    } catch {
      return {
        candidate: buildFallbackCandidate(fallback, macro),
        hasLivePriceData: false,
      } satisfies CandidateBuildResult;
    }

    return {
      candidate: buildFallbackCandidate(fallback, macro),
      hasLivePriceData: false,
    } satisfies CandidateBuildResult;
  });

  const builtCandidates = results.filter(
    (result): result is CandidateBuildResult => result !== null,
  );

  return {
    candidates: builtCandidates.map((result) => result.candidate),
    livePriceCount: builtCandidates.filter((result) => result.hasLivePriceData).length,
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

  return rankEquityCandidates(universe, {
    asOf,
    limit,
    source: "fmp",
    dataQuality: {
      priceData:
        livePriceCount === universe.length ? "live" : livePriceCount > 0 ? "partial" : "mock",
      financialData: "partial",
      macroData: combinedMacro.isLive ? "live" : "partial",
      notes: [
        "Live FMP daily candles are used for technical scoring. Starter universe metadata and fallback fundamentals are used when low-cost FMP plan limits block company fundamentals.",
        `${livePriceCount} of ${universe.length} ranked symbols used live FMP price candles in this run.`,
        combinedMacro.isLive
          ? "Live government macro data is connected through FRED and/or BLS."
          : "Government macro data fell back to a neutral placeholder for this run.",
        "News, earnings calendar, and SEC filing checks are still placeholders in this live-data slice.",
        ...combinedMacro.notes,
        skippedCount > 0
          ? `${skippedCount} symbols were skipped because no starter fallback was available.`
          : "All requested symbols were ranked; symbols without live FMP candles used starter technical fallbacks.",
      ],
    },
    summaryPrefix: "FMP-backed morning agent",
  });
}

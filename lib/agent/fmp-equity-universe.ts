import {
  getFmpCompanyScreener,
  getFmpCompanyProfile,
  getFmpEarnings,
  getFmpHistoricalCandles,
  getFmpIncomeStatements,
  getFmpKeyMetricsTtm,
  getFmpRatiosTtm,
  getFmpSecFilingsBySymbol,
  getFmpStockNews,
  type FmpCompanyScreenerRow,
  type FmpEarningsEvent,
  hasFmpCredentials,
  type FmpHistoricalCandle,
  type FmpIncomeStatement,
  type FmpSecFiling,
  type FmpStockNews,
} from "@/lib/providers/fmp";
import { getBlsMacroContext, type BlsMacroContext } from "@/lib/providers/bls";
import { getFredMacroContext, type FredMacroContext } from "@/lib/providers/fred";
import { getSecSubmissionsByCik } from "@/lib/providers/sec-edgar";
import { getTreasuryMacroContext, type TreasuryMacroContext } from "@/lib/providers/treasury";
import { getMockEquityUniverse } from "./mock-equity-universe";
import { rankEquityCandidates } from "./ranking-agent";
import type { AgentRunResult, CompanyFinancialSnapshot, EquityCandidate, Sector } from "./types";

const starterSymbols = [
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
  universeLimit?: number;
  detailedLimit?: number;
};

type CandidateBuildResult = {
  candidate: EquityCandidate;
  hasLivePriceData: boolean;
  hasLiveFinancialData: boolean;
  hasLiveNewsData: boolean;
  hasLiveEventData: boolean;
  hasLiveSecData: boolean;
};

type CandidateBuildMode = "full" | "price-only";

type CombinedMacroContext = FredMacroContext & {
  bls: BlsMacroContext;
  treasury: TreasuryMacroContext;
};

type BenchmarkReturnSnapshot = {
  return21d: number;
  return63d: number;
  return126d: number;
};

type BenchmarkContext = {
  market: BenchmarkReturnSnapshot | null;
  sectors: Partial<Record<Sector, BenchmarkReturnSnapshot>>;
  notes: string[];
};

const sectorEtfs: Record<Sector, string> = {
  "Communication Services": "XLC",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Financials: "XLF",
  "Health Care": "XLV",
  Industrials: "XLI",
  "Information Technology": "XLK",
  Materials: "XLB",
  "Real Estate": "XLRE",
  Utilities: "XLU",
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

function latestValue<T>(values: T[]) {
  return values[values.length - 1];
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function envFlag(name: string, fallback = false) {
  const value = process.env[name];

  if (value === undefined) return fallback;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function containsAny(value: string, keywords: readonly string[]) {
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

function buildNeutralFallbackCandidate(
  symbol: string,
  asOf: Date,
  row?: FmpCompanyScreenerRow,
): EquityCandidate {
  const price = Number.isFinite(row?.price) && row?.price ? Number(row.price) : 100;
  const marketCapBillions =
    Number.isFinite(row?.marketCap) && row?.marketCap
      ? Number(row.marketCap) / 1_000_000_000
      : 5;
  const averageVolume =
    Number.isFinite(row?.volume) && row?.volume ? Number(row.volume) : 1_000_000;
  const sector = mapSector(row?.sector);

  return {
    symbol,
    companyName: row?.companyName ?? symbol,
    sector,
    averageVolume,
    marketCapBillions,
    technical: {
      price: round(price, 2),
      sma20: round(price, 2),
      sma50: round(price * 0.99, 2),
      sma200: round(price * 0.96, 2),
      rsi14: 50,
      atrPercent: 4,
      relativeStrength90d: 50,
      support: round(price * 0.94, 2),
      resistance: round(price * 1.1, 2),
      volumeTrend: 0,
    },
    financials: {
      revenueGrowth: 8,
      earningsGrowth: 8,
      freeCashFlowYield: 3,
      debtToEquity: 1,
      marginTrend: 0,
      revisionScore: 55,
      valuationScore: 55,
    },
    news: {
      sentimentScore: 55,
      catalystScore: 52,
      headlineCount: 0,
      riskFlagCount: 0,
      summary: `${symbol} was discovered through the FMP broad market screener.`,
    },
    market: {
      marketRegimeScore: 55,
      sectorTrendScore: 55,
      economicSurpriseScore: 55,
      ratesPressureScore: 55,
      breadthScore: 55,
      govDataSummary: `Neutral fallback created ${asOf.toISOString().slice(0, 10)} until live market context is applied.`,
    },
  };
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

function closeReturn(closes: number[], periodsBack: number) {
  const current = latestValue(closes);
  const previous = closes[Math.max(0, closes.length - 1 - periodsBack)];
  return percentChange(current, previous);
}

function benchmarkReturns(candles: FmpHistoricalCandle[]): BenchmarkReturnSnapshot | null {
  const sorted = sortCandles(candles);

  if (sorted.length < 130) {
    return null;
  }

  const closes = sorted.map((candle) => candle.close ?? 0);

  return {
    return21d: round(closeReturn(closes, 21), 1),
    return63d: round(closeReturn(closes, 63), 1),
    return126d: round(closeReturn(closes, 126), 1),
  };
}

async function getBenchmarkContext(asOf: Date) {
  const from = daysAgo(asOf, 220);
  const to = asOf.toISOString().slice(0, 10);
  const marketSymbols = ["SPY", "QQQ"];
  const sectorEntries = Object.entries(sectorEtfs) as Array<[Sector, string]>;
  const [marketResults, sectorResults] = await Promise.all([
    Promise.all(marketSymbols.map((symbol) => optionalArray(getFmpHistoricalCandles(symbol, from, to)))),
    Promise.all(
      sectorEntries.map(async ([sector, symbol]) => ({
        sector,
        snapshot: benchmarkReturns(await optionalArray(getFmpHistoricalCandles(symbol, from, to))),
      })),
    ),
  ]);
  const marketSnapshots = marketResults
    .map((candles) => benchmarkReturns(candles))
    .filter((snapshot) => snapshot !== null);
  const market =
    marketSnapshots.length > 0
      ? {
          return21d: round(average(marketSnapshots.map((item) => item.return21d)), 1),
          return63d: round(average(marketSnapshots.map((item) => item.return63d)), 1),
          return126d: round(average(marketSnapshots.map((item) => item.return126d)), 1),
        }
      : null;
  const sectors: Partial<Record<Sector, BenchmarkReturnSnapshot>> = {};

  sectorResults.forEach(({ sector, snapshot }) => {
    if (snapshot) {
      sectors[sector] = snapshot;
    }
  });

  return {
    market,
    sectors,
    notes: [
      market
        ? "SPY/QQQ benchmark candles are connected for market-relative strength."
        : "SPY/QQQ benchmark candles were unavailable; market-relative strength used neutral fallback.",
      Object.keys(sectors).length > 0
        ? `${Object.keys(sectors).length} sector ETF benchmarks are connected for sector-relative strength.`
        : "Sector ETF benchmark candles were unavailable; sector-relative strength used neutral fallback.",
    ],
  } satisfies BenchmarkContext;
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

function buildTechnicalSnapshot(
  candles: FmpHistoricalCandle[],
  sector: Sector,
  benchmarks: BenchmarkContext,
) {
  const sorted = sortCandles(candles);

  if (sorted.length < 210) {
    return null;
  }

  const closes = sorted.map((candle) => candle.close ?? 0);
  const volumes = sorted.map((candle) => candle.volume ?? 0);
  const latest = sorted[sorted.length - 1];
  const price = latest.close ?? 0;
  const close90DaysAgo = closes[Math.max(0, closes.length - 91)];
  const return21d = closeReturn(closes, 21);
  const return63d = closeReturn(closes, 63);
  const return126d = closeReturn(closes, 126);
  const marketReturn = benchmarks.market
    ? benchmarks.market.return21d * 0.45 +
      benchmarks.market.return63d * 0.35 +
      benchmarks.market.return126d * 0.2
    : return21d * 0.35 + return63d * 0.4 + return126d * 0.25;
  const sectorBenchmark = benchmarks.sectors[sector];
  const sectorReturn = sectorBenchmark
    ? sectorBenchmark.return21d * 0.45 +
      sectorBenchmark.return63d * 0.35 +
      sectorBenchmark.return126d * 0.2
    : marketReturn;
  const relativeStrength90d = clamp(50 + percentChange(price, close90DaysAgo) * 1.8, 25, 100);
  const recent20 = sorted.slice(-20);
  const recent40 = sorted.slice(-40);
  const volume20 = average(volumes.slice(-20));
  const volume50Previous = average(volumes.slice(-70, -20));
  const trendQuality = clamp(
    45 +
      (price > average(closes.slice(-20)) ? 10 : -8) +
      (average(closes.slice(-20)) > average(closes.slice(-50)) ? 12 : -8) +
      (average(closes.slice(-50)) > average(closes.slice(-200)) ? 12 : -10) +
      Math.min(16, Math.max(-12, return63d * 0.65)) +
      Math.min(10, Math.max(-10, percentChange(volume20, volume50Previous) * 0.2)),
    0,
    100,
  );
  const resistance = Math.max(...recent40.map((candle) => candle.high ?? price));
  const breakoutProximity = clamp(100 - Math.abs(((resistance - price) / price) * 100) * 12, 0, 100);

  return {
    price: round(price, 2),
    sma20: round(average(closes.slice(-20)), 2),
    sma50: round(average(closes.slice(-50)), 2),
    sma200: round(average(closes.slice(-200)), 2),
    rsi14: round(calculateRsi(closes), 1),
    atrPercent: round(calculateAtrPercent(sorted, price), 1),
    relativeStrength90d: Math.round(relativeStrength90d),
    relativeStrengthVsMarket: Math.round(clamp(50 + (return21d * 0.45 + return63d * 0.35 + return126d * 0.2 - marketReturn) * 2.4, 0, 100)),
    relativeStrengthVsSector: Math.round(clamp(50 + (return21d * 0.45 + return63d * 0.35 + return126d * 0.2 - sectorReturn) * 2.6, 0, 100)),
    trendQuality: Math.round(trendQuality),
    breakoutProximity: Math.round(breakoutProximity),
    support: round(Math.min(...recent20.map((candle) => candle.low ?? price)), 2),
    resistance: round(resistance, 2),
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
    "guidance raise",
    "buyback",
    "repurchase",
    "accelerates",
    "profit",
    "margin",
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
    "offering",
    "dilution",
    "secondary",
    "layoff",
    "slashed",
    "fraud",
    "short seller",
  ];
  const catalystGroups = [
    ["earnings strength", ["beat", "beats", "eps", "revenue", "profit", "margin"]],
    ["guidance improvement", ["raise", "raises", "raised", "guidance", "outlook"]],
    ["analyst support", ["upgrade", "upgraded", "price target", "initiated"]],
    ["business momentum", ["contract", "partnership", "launch", "expands", "approval", "approved"]],
    ["capital return", ["buyback", "repurchase", "dividend"]],
  ] as const;
  const filingSeverity: Record<string, number> = {
    "8-K": 1,
    "S-1": 4,
    "S-3": 4,
    "424B5": 4,
    "424B2": 3,
    "NT 10-K": 3,
    "NT 10-Q": 3,
    "10-K": 1,
    "10-Q": 1,
  };
  const recentNews = args.news.filter((item) => {
    if (!item.publishedDate) return false;
    return Math.abs(daysBetween(new Date(item.publishedDate), args.asOf)) <= 14;
  });
  const newsText = recentNews
    .map((item) => `${item.title ?? ""} ${item.text ?? ""}`)
    .join(" ");
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
  const filingRiskScore = clamp(
    recentFilings.reduce((total, filing) => total + (filingSeverity[filing.formType ?? ""] ?? 0), 0) * 11,
    0,
    100,
  );
  const riskFilingCount = recentFilings.filter((filing) => (filingSeverity[filing.formType ?? ""] ?? 0) >= 3).length;
  const earningsRisk =
    daysToEarnings !== null && daysToEarnings <= 3
      ? 34
      : daysToEarnings !== null && daysToEarnings <= 7
        ? 24
        : daysToEarnings !== null && daysToEarnings <= 14
          ? 12
          : 0;
  const eventRiskScore = clamp(earningsRisk + negativeCount * 9 + riskFilingCount * 14, 0, 100);
  const catalystTags = catalystGroups
    .filter(([, keywords]) => containsAny(newsText, keywords))
    .map(([label]) => label);
  const riskFlagCount = Math.max(
    0,
    negativeCount + riskFilingCount + (eventRiskScore >= 24 ? 1 : 0),
  );
  const sentimentScore = clamp(55 + positiveCount * 8 - negativeCount * 11 + Math.min(recentNews.length, 8) * 1.5);
  const catalystScore = clamp(
    48 +
      positiveCount * 9 +
      catalystTags.length * 4 +
      Math.max(0, epsSurprise) * 0.35 +
      (daysToEarnings !== null && daysToEarnings <= 21 ? 5 : 0) -
      negativeCount * 8 -
      riskFilingCount * 8 -
      Math.max(0, eventRiskScore - 30) * 0.16,
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

  if (catalystTags.length > 0) {
    summaryParts.push(`catalyst types: ${catalystTags.slice(0, 3).join(", ")}`);
  }

  if (eventRiskScore >= 40 || filingRiskScore >= 35) {
    summaryParts.push("event or filing risk is elevated");
  }

  return {
    snapshot: {
      sentimentScore: Math.round(sentimentScore),
      catalystScore: Math.round(catalystScore),
      headlineCount: recentNews.length,
      riskFlagCount,
      catalystTags,
      eventRiskScore: Math.round(eventRiskScore),
      filingRiskScore: Math.round(filingRiskScore),
      daysToEarnings,
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

async function optionalArray<T>(promise: Promise<T[]>) {
  return promise.catch(() => [] as T[]);
}

async function optionalValue<T>(promise: Promise<T | null>) {
  return promise.catch(() => null);
}

function combineMacroContexts(
  fred: FredMacroContext,
  bls: BlsMacroContext,
  treasury: TreasuryMacroContext,
) {
  const economicSurpriseScore = clamp(
    fred.economicSurpriseScore +
      bls.economicSurpriseAdjustment +
      treasury.economicSurpriseAdjustment,
    20,
    90,
  );
  const ratesPressureScore = clamp(
    fred.ratesPressureScore + bls.ratesPressureAdjustment + treasury.ratesPressureAdjustment,
    20,
    95,
  );
  const marketRegimeScore = clamp(
    fred.marketRegimeScore +
      bls.economicSurpriseAdjustment * 0.28 -
      bls.ratesPressureAdjustment * 0.22 +
      treasury.economicSurpriseAdjustment * 0.18 -
      treasury.ratesPressureAdjustment * 0.16,
    20,
    90,
  );

  return {
    ...fred,
    bls,
    treasury,
    isLive: fred.isLive || bls.isLive || treasury.isLive,
    marketRegimeScore: Math.round(marketRegimeScore),
    economicSurpriseScore: Math.round(economicSurpriseScore),
    ratesPressureScore: Math.round(ratesPressureScore),
    summary: `${fred.summary} ${bls.summary} ${treasury.summary}`,
    notes: [...fred.notes, ...bls.notes, ...treasury.notes],
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
  benchmarks: BenchmarkContext,
  fallback: EquityCandidate,
  mode: CandidateBuildMode = "full",
) {
  const from = daysAgo(asOf, 430);
  const to = asOf.toISOString().slice(0, 10);
  const secFrom = daysAgo(asOf, 45);
  const earningsTo = daysAhead(asOf, 90);

  const candles = await optionalArray(getFmpHistoricalCandles(symbol, from, to));
  const fallbackSector = mapSector(fallback.sector);
  const earlyTechnical = buildTechnicalSnapshot(candles, fallbackSector, benchmarks);

  if (!earlyTechnical) {
    return null;
  }

  if (mode === "price-only") {
    const sector = fallbackSector;

    return {
      candidate: {
        symbol,
        companyName: fallback.companyName,
        sector,
        averageVolume: fallback.averageVolume,
        marketCapBillions: fallback.marketCapBillions,
        technical: earlyTechnical,
        financials: fallback.financials,
        news: {
          sentimentScore: 55,
          catalystScore: 52,
          headlineCount: 0,
          riskFlagCount: 0,
          summary:
            `${symbol} passed the live price and technical scan. News, event, SEC, and financial enrichment is reserved for the strongest candidates to control API cost and rate limits.`,
        },
        market: {
          ...buildMarketSnapshot(sector, macro),
        },
      },
      hasLiveFinancialData: false,
      hasLiveNewsData: false,
      hasLiveEventData: false,
      hasLiveSecData: false,
    };
  }

  const [profile, incomeStatements, ratios, keyMetrics, news, earnings, secFilings] =
    await Promise.all([
    optionalValue(getFmpCompanyProfile(symbol)),
    optionalArray(getFmpIncomeStatements(symbol, 4)),
    optionalValue(getFmpRatiosTtm(symbol)),
    optionalValue(getFmpKeyMetricsTtm(symbol)),
    optionalArray(getFmpStockNews(symbol, 10)),
    optionalArray(getFmpEarnings(symbol, 8)),
    optionalArray(getFmpSecFilingsBySymbol(symbol, secFrom, earningsTo, 12)),
  ]);
  const directSecFilings =
    secFilings.length > 0 ? [] : await optionalArray(getSecSubmissionsByCik(profile?.cik));
  const allSecFilings = secFilings.length > 0 ? secFilings : directSecFilings;
  const sector = mapSector(profile?.sector ?? fallback.sector);
  const technical =
    sector === fallbackSector ? earlyTechnical : buildTechnicalSnapshot(candles, sector, benchmarks) ?? earlyTechnical;

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
    filings: allSecFilings,
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

function rankScreenerRows(rows: FmpCompanyScreenerRow[]) {
  const seenCompanyKeys = new Set<string>();
  const excludedNameTerms = [
    " etf",
    " fund",
    " trust",
    " acquisition",
    " spac",
    " warrant",
    " unit",
    " notes",
  ];

  return [...rows]
    .filter((row) => {
      const symbol = row.symbol?.toUpperCase() ?? "";
      const name = row.companyName?.toLowerCase() ?? "";
      const exchange = row.exchangeShortName?.toUpperCase() ?? row.exchange?.toUpperCase() ?? "";

      return (
        /^[A-Z]{1,5}$/.test(symbol) &&
        ["NASDAQ", "NYSE", "AMEX"].includes(exchange) &&
        row.isEtf !== true &&
        !excludedNameTerms.some((term) => name.includes(term))
      );
    })
    .sort((a, b) => {
      const swingCandidateScore = (row: FmpCompanyScreenerRow) => {
        const marketCap = Number(row.marketCap ?? 0);
        const volume = Number(row.volume ?? 0);
        const price = Number(row.price ?? 0);
        const beta = Number(row.beta ?? 1);
        const liquidity = Math.log10(Math.max(volume, 1)) * 7;
        const capBillions = marketCap / 1_000_000_000;
        const capSweetSpot =
          capBillions >= 3 && capBillions <= 250
            ? 16
            : capBillions > 250
              ? Math.max(5, 16 - Math.log10(capBillions / 250) * 9)
              : Math.max(0, capBillions * 3);
        const betaSweetSpot =
          beta >= 0.8 && beta <= 2.2 ? 14 : beta > 2.8 ? 4 : beta > 0 ? 8 : 6;
        const priceQuality = price >= 8 && price <= 500 ? 10 : price > 500 ? 5 : 2;

        return liquidity + capSweetSpot + betaSweetSpot + priceQuality;
      };
      const aScore = swingCandidateScore(a);
      const bScore = swingCandidateScore(b);

      return bScore - aScore;
    })
    .filter((row) => {
      const companyKey = (row.companyName ?? row.symbol ?? "")
        .toLowerCase()
        .replace(/\b(class|ordinary|common|stock|shares|share|inc|corp|corporation|company|co|ltd|plc|nv|sa)\b/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (!companyKey) return true;
      if (seenCompanyKeys.has(companyKey)) return false;

      seenCompanyKeys.add(companyKey);
      return true;
    });
}

function hasSwingQuality(candidate: EquityCandidate) {
  const price = candidate.technical.price;
  const upsideRoom =
    price > 0 ? ((candidate.technical.resistance - price) / price) * 100 : 0;

  return (
    candidate.averageVolume >= 500_000 &&
    candidate.marketCapBillions >= 1 &&
    price >= 5 &&
    upsideRoom >= 3.5 &&
    (candidate.technical.relativeStrengthVsMarket ?? 50) >= 32 &&
    (candidate.technical.relativeStrengthVsSector ?? 50) >= 30 &&
    (candidate.technical.trendQuality ?? 50) >= 34 &&
    candidate.technical.volumeTrend >= -35 &&
    candidate.technical.support > 0 &&
    candidate.technical.resistance > candidate.technical.support
  );
}

function dataQualityLabel(liveCount: number, total: number) {
  if (total === 0) return "mock";
  if (liveCount === total) return "live";
  if (liveCount > 0) return "partial";
  return "mock";
}

async function getBroadFmpScreenerRows(limit: number) {
  try {
    const rows = await getFmpCompanyScreener(limit);
    return rankScreenerRows(rows);
  } catch {
    return [] as FmpCompanyScreenerRow[];
  }
}

export async function getFmpEquityUniverse(
  asOf: Date,
  macro: CombinedMacroContext,
  benchmarks: BenchmarkContext,
  symbols: string[],
  screenerRows: FmpCompanyScreenerRow[] = [],
  allowFallbackForMissing = true,
  mode: CandidateBuildMode = "full",
) {
  if (!hasFmpCredentials()) {
    throw new Error("FMP_API_KEY is not configured.");
  }

  const screenerBySymbol = new Map(
    screenerRows
      .filter((row) => row.symbol)
      .map((row) => [String(row.symbol).toUpperCase(), row] as const),
  );
  const fallbackBySymbol = new Map<string, EquityCandidate>(
    getMockEquityUniverse(asOf).map((candidate) => [candidate.symbol, candidate]),
  );

  symbols.forEach((symbol) => {
    const normalized = symbol.toUpperCase();

    if (!fallbackBySymbol.has(normalized)) {
      fallbackBySymbol.set(
        normalized,
        buildNeutralFallbackCandidate(normalized, asOf, screenerBySymbol.get(normalized)),
      );
    }
  });

  const throttleMs = envNumber("FMP_CANDIDATE_DELAY_MS", 150, 0, 2000);
  const candidateConcurrency = envNumber("FMP_CANDIDATE_CONCURRENCY", 1, 1, 4);
  const results = await mapWithConcurrency<string, CandidateBuildResult | null>(symbols, candidateConcurrency, async (symbol) => {
    const fallback = fallbackBySymbol.get(symbol);

    if (!fallback) {
      return null;
    }

    try {
      const candidate = await buildFmpCandidate(symbol, asOf, macro, benchmarks, fallback, mode);

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

	      if (!allowFallbackForMissing) {
	        return null;
	      }

	      return {
	        candidate: buildFallbackCandidate(fallback, macro),
	        hasLivePriceData: false,
	        hasLiveFinancialData: false,
	        hasLiveNewsData: false,
	        hasLiveEventData: false,
	        hasLiveSecData: false,
	      } satisfies CandidateBuildResult;
	    } catch {
	      if (!allowFallbackForMissing) {
	        return null;
	      }

	      return {
	        candidate: buildFallbackCandidate(fallback, macro),
	        hasLivePriceData: false,
	        hasLiveFinancialData: false,
	        hasLiveNewsData: false,
	        hasLiveEventData: false,
	        hasLiveSecData: false,
	      } satisfies CandidateBuildResult;
	    } finally {
	      if (throttleMs > 0) {
	        await sleep(throttleMs);
	      }
    }
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
  symbols,
  universeLimit = envNumber("FMP_UNIVERSE_LIMIT", 1000, 40, 1500),
  detailedLimit = envNumber("FMP_DETAILED_LIMIT", 350, 30, 500),
}: RunFmpOptions = {}): Promise<AgentRunResult> {
  const minimumScreenerCount = envNumber("FMP_MIN_SCREENER_ROWS", 250, 40, 1500);
  const minimumDetailedCandidateCount = envNumber("FMP_MIN_DETAILED_CANDIDATES", 120, 30, 500);
  const enrichmentLimit = envNumber("FMP_ENRICHMENT_LIMIT", 90, limit, 150);
  const coverageGateEnabled = !envFlag("DISABLE_MARKET_COVERAGE_GATE", false);
  const macro = await getFredMacroContext();
  const bls = await getBlsMacroContext();
  const treasury = await getTreasuryMacroContext();
  const combinedMacro = combineMacroContexts(macro, bls, treasury);
  const [benchmarks, screenerRows] = await Promise.all([
    getBenchmarkContext(asOf),
    symbols ? Promise.resolve([] as FmpCompanyScreenerRow[]) : getBroadFmpScreenerRows(universeLimit),
  ]);
  const universeSymbols =
    symbols?.map((symbol) => symbol.toUpperCase()) ??
    (screenerRows.length > 0
      ? rankScreenerRows(screenerRows)
          .slice(0, detailedLimit)
          .map((row) => String(row.symbol).toUpperCase())
      : starterSymbols);
  const initialUniverseResult = await getFmpEquityUniverse(
    asOf,
    combinedMacro,
    benchmarks,
    universeSymbols,
    screenerRows,
    false,
    symbols ? "full" : "price-only",
  );
  const qualityUniverse = initialUniverseResult.candidates.filter(hasSwingQuality);
  const initialUniverse =
    qualityUniverse.length >= limit ? qualityUniverse : initialUniverseResult.candidates;
  const qualityFilteredCount =
    qualityUniverse.length >= limit ? initialUniverseResult.candidates.length - initialUniverse.length : 0;
  const qualitySupplementCount =
    qualityUniverse.length < limit ? initialUniverse.length - qualityUniverse.length : 0;
  const skippedCount = universeSymbols.length - initialUniverse.length;
  const coverageWarning =
    symbols
      ? null
      : screenerRows.length < minimumScreenerCount
        ? `Market coverage gate failed: FMP screener returned ${screenerRows.length} rows, below the required ${minimumScreenerCount}.`
        : initialUniverseResult.candidates.length < minimumDetailedCandidateCount
          ? `Market coverage gate failed: only ${initialUniverseResult.candidates.length} live technical candidates were analyzed, below the required ${minimumDetailedCandidateCount}.`
          : null;
  const coverageStatus = coverageWarning ? "blocked" : qualityUniverse.length < limit ? "thin" : "healthy";

  if (coverageGateEnabled && coverageWarning) {
    throw new Error(
      `${coverageWarning} The daily ranking run was blocked so customers do not receive a thin market scan. Increase FMP coverage, loosen screener limits, or set DISABLE_MARKET_COVERAGE_GATE=true only for temporary testing.`,
    );
  }

  const preliminaryRanking =
    !symbols && initialUniverse.length > limit
      ? rankEquityCandidates(initialUniverse, {
          asOf,
          limit: enrichmentLimit,
          source: "fmp",
          dataQuality: {
            priceData: dataQualityLabel(
              Math.min(initialUniverseResult.livePriceCount, initialUniverse.length),
              initialUniverse.length,
            ),
            financialData: "partial",
            macroData: combinedMacro.isLive ? "live" : "partial",
            newsData: "partial",
            eventData: "partial",
            secData: "partial",
            marketCoverage: {
              status: coverageStatus,
              requestedUniverseLimit: universeLimit,
              screenerCount: screenerRows.length,
              detailedCandidateTarget: detailedLimit,
              detailedCandidateCount: initialUniverseResult.candidates.length,
              qualifiedCandidateCount: qualityUniverse.length,
              rankedCandidateCount: initialUniverse.length,
              minimumScreenerCount,
              minimumDetailedCandidateCount,
              warning: coverageWarning,
            },
            notes: [
              "Preliminary technical scan used live FMP daily candles before expensive enrichment.",
            ],
          },
          summaryPrefix: "FMP-backed preliminary scan",
        })
      : null;
  const enrichmentSymbols =
    preliminaryRanking?.rankings.map((ranking) => ranking.candidate.symbol) ??
    initialUniverse.slice(0, enrichmentLimit).map((candidate) => candidate.symbol);
  const enrichedUniverseResult =
    !symbols && enrichmentSymbols.length > 0
      ? await getFmpEquityUniverse(
          asOf,
          combinedMacro,
          benchmarks,
          enrichmentSymbols,
          screenerRows,
          true,
          "full",
        )
      : initialUniverseResult;
  const baseBySymbol = new Map(initialUniverse.map((candidate) => [candidate.symbol, candidate] as const));
  const enrichedBySymbol = new Map(
    enrichedUniverseResult.candidates.map((candidate) => [candidate.symbol, candidate] as const),
  );
  const selectedSymbols = new Set<string>();
  const universe = [
    ...enrichmentSymbols
      .map((symbol) => {
        selectedSymbols.add(symbol);
        return enrichedBySymbol.get(symbol) ?? baseBySymbol.get(symbol);
      })
      .filter((candidate) => candidate !== undefined),
    ...initialUniverse.filter((candidate) => !selectedSymbols.has(candidate.symbol)),
  ].slice(0, Math.max(enrichmentLimit, limit));

  const livePriceCount = initialUniverseResult.livePriceCount;
  const liveFinancialCount = enrichedUniverseResult.liveFinancialCount;
  const liveNewsCount = enrichedUniverseResult.liveNewsCount;
  const liveEventCount = enrichedUniverseResult.liveEventCount;
  const liveSecCount = enrichedUniverseResult.liveSecCount;

  return rankEquityCandidates(universe, {
    asOf,
    limit,
    source: "fmp",
    dataQuality: {
      priceData:
        dataQualityLabel(Math.min(livePriceCount, universe.length), universe.length),
      financialData: dataQualityLabel(Math.min(liveFinancialCount, universe.length), universe.length),
      macroData: combinedMacro.isLive ? "live" : "partial",
      newsData: dataQualityLabel(Math.min(liveNewsCount, universe.length), universe.length),
      eventData: dataQualityLabel(Math.min(liveEventCount, universe.length), universe.length),
      secData: dataQualityLabel(Math.min(liveSecCount, universe.length), universe.length),
      marketCoverage: {
        status: coverageStatus,
        requestedUniverseLimit: universeLimit,
        screenerCount: screenerRows.length,
        detailedCandidateTarget: detailedLimit,
        detailedCandidateCount: initialUniverseResult.candidates.length,
        qualifiedCandidateCount: qualityUniverse.length,
        rankedCandidateCount: universe.length,
        minimumScreenerCount,
        minimumDetailedCandidateCount,
        warning: coverageWarning,
      },
      notes: [
        "Data quality gate checks market data, news/catalyst data, SEC/corporate event data, macro data, enough liquidity, volume trend, relative strength, and clean technical structure before a symbol is trusted.",
        "Live FMP daily candles are used for technical scoring. FMP profiles, statements, ratios, and key metrics are used for financial scoring when available.",
        "SPY/QQQ and sector ETF candles are used to judge whether each stock is outperforming the broader market and its sector.",
        symbols
          ? `This run used ${universeSymbols.length} explicitly requested symbols.`
          : screenerRows.length > 0
            ? `FMP broad screener reviewed ${screenerRows.length} liquid US candidates, technically scanned ${universeSymbols.length} symbols, and enriched the strongest ${enrichmentSymbols.length} before selecting the top ${limit}.`
            : `FMP screener was unavailable, so the agent fell back to the ${starterSymbols.length}-symbol starter universe.`,
        `${livePriceCount} of ${initialUniverseResult.candidates.length} technical candidates used live FMP price candles in this run.`,
        `${liveFinancialCount} of ${enrichedUniverseResult.candidates.length} enriched candidates used live FMP fundamental data in this run.`,
        `${liveNewsCount} of ${enrichedUniverseResult.candidates.length} enriched candidates used live FMP stock news for catalyst scoring.`,
        `${liveEventCount} of ${enrichedUniverseResult.candidates.length} enriched candidates used live FMP earnings/corporate event data.`,
        `${liveSecCount} of ${enrichedUniverseResult.candidates.length} enriched candidates used live SEC filing checks from FMP or direct SEC EDGAR fallback.`,
        qualityFilteredCount > 0
          ? `${qualityFilteredCount} live candidates were removed by the swing-quality gate for weak liquidity, upside room, relative strength, volume trend, or technical structure.`
          : qualitySupplementCount > 0
            ? `${qualityUniverse.length} live candidates passed every swing-quality gate; ${qualitySupplementCount} additional live-data candidates were kept to preserve a useful top-${limit} research list.`
            : "All live candidates passed the swing-quality gate.",
        combinedMacro.isLive
          ? "Live government macro data is connected through FRED and/or BLS."
          : "Government macro data fell back to a neutral placeholder for this run.",
        ...benchmarks.notes,
        ...combinedMacro.notes,
        skippedCount > 0
          ? `${skippedCount} symbols were skipped because no screener or starter fallback was available.`
          : livePriceCount === universe.length
            ? "All requested symbols were ranked with live FMP price candles."
            : "All requested symbols were ranked; symbols without complete live FMP candles used conservative screener or starter fallbacks.",
      ],
    },
    summaryPrefix: "FMP-backed morning agent",
  });
}

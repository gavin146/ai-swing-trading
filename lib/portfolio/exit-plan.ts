import {
  getFmpCompanyProfile,
  getFmpHistoricalCandles,
  type FmpHistoricalCandle,
} from "@/lib/providers/fmp";
import { getOpportunityBySymbol } from "@/lib/repositories/opportunities";

export type PortfolioExitPlanSource = "swingfi_daily_analysis" | "market_structure_estimate";

export type PortfolioExitPlan = {
  actionLabel: string;
  actionTone: "positive" | "neutral" | "caution";
  checklist: string[];
  confidence: "higher" | "estimate";
  currentPrice: number | null;
  dataQuality: "daily_analysis" | "live_structure" | "limited_structure";
  explanation: string;
  holdingPeriodDays: number;
  invalidationSignals: string[];
  rewardRiskRatio: number;
  source: PortfolioExitPlanSource;
  stopLoss: number;
  takeProfitZoneHigh: number;
  takeProfitZoneLow: number;
  targetPrice: number;
  trailingStop: number;
  trendState: "uptrend" | "sideways" | "downtrend" | "unknown";
};

function roundPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number(value.toFixed(value >= 1000 ? 0 : 2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isoDateDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sortCandlesAscending(candles: Array<{ date?: string }>) {
  return [...candles].sort((a, b) => {
    const aTime = new Date(String(a.date ?? "")).getTime();
    const bTime = new Date(String(b.date ?? "")).getTime();

    return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
  });
}

function numberValues(values: Array<number | undefined>) {
  return values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
}

function simpleMovingAverage(values: number[], length: number) {
  if (values.length < length) return 0;
  return average(values.slice(-length));
}

function relativeStrengthIndex(closes: number[], length = 14) {
  if (closes.length <= length) return 50;

  const window = closes.slice(-(length + 1));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < window.length; index += 1) {
    const change = window[index] - window[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) return 100;

  const rs = gains / Math.max(losses, 0.01);
  return 100 - 100 / (1 + rs);
}

function priceRangeAverage(candles: Array<{ high?: number; low?: number }>) {
  return average(
    candles
      .map((candle) => Number(candle.high) - Number(candle.low))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
}

function rewardRiskRatio(entryPrice: number, targetPrice: number, stopLoss: number) {
  const reward = targetPrice - entryPrice;
  const risk = entryPrice - stopLoss;

  return risk > 0 ? reward / risk : 0;
}

function trendStateFromCandles(candles: FmpHistoricalCandle[], referencePrice: number) {
  const closes = numberValues(candles.map((candle) => candle.close));
  const sma10 = simpleMovingAverage(closes, 10);
  const sma20 = simpleMovingAverage(closes, 20);
  const sma50 = simpleMovingAverage(closes, 50);

  if (!sma10 || !sma20 || !sma50) return "unknown" as const;
  if (referencePrice >= sma10 && sma10 >= sma20 && sma20 >= sma50) return "uptrend" as const;
  if (referencePrice < sma20 && sma20 < sma50) return "downtrend" as const;
  return "sideways" as const;
}

function buildPlanGuidance(args: {
  candles: FmpHistoricalCandle[];
  confidence: PortfolioExitPlan["confidence"];
  currentPrice: number | null;
  dataQuality: PortfolioExitPlan["dataQuality"];
  entryPrice: number;
  explanation: string;
  holdingPeriodDays: number;
  source: PortfolioExitPlanSource;
  stopLoss: number;
  targetPrice: number;
}) {
  const sortedCandles = sortCandlesAscending(args.candles) as FmpHistoricalCandle[];
  const recentCandles = sortedCandles.slice(-45);
  const referencePrice = args.currentPrice ?? numberValues(recentCandles.map((candle) => candle.close)).at(-1) ?? args.entryPrice;
  const avgRange = priceRangeAverage(recentCandles);
  const atrPct = avgRange > 0 ? clamp(avgRange / referencePrice, 0.012, 0.09) : 0.035;
  const closes = numberValues(recentCandles.map((candle) => candle.close));
  const rsi = relativeStrengthIndex(closes);
  const trendState = trendStateFromCandles(sortedCandles, referencePrice);
  const rr = rewardRiskRatio(args.entryPrice, args.targetPrice, args.stopLoss);
  const targetDistancePct = ((args.targetPrice - referencePrice) / referencePrice) * 100;
  const stopDistancePct = ((referencePrice - args.stopLoss) / referencePrice) * 100;
  const takeProfitZoneLow = roundPrice(args.targetPrice * 0.97);
  const takeProfitZoneHigh = roundPrice(args.targetPrice);
  const trailingStop = roundPrice(
    Math.max(args.stopLoss, referencePrice * (1 - Math.max(atrPct * 1.45, 0.035))),
  );
  const actionTone =
    referencePrice >= args.targetPrice || referencePrice <= args.stopLoss || trendState === "downtrend"
      ? "caution"
      : rr < 1.5 || targetDistancePct <= 2.5 || rsi >= 72
        ? "neutral"
        : "positive";
  const actionLabel =
    referencePrice >= args.targetPrice
      ? "Review profit-taking now"
      : referencePrice <= args.stopLoss
        ? "Review exit: stop is breached"
        : trendState === "downtrend"
          ? "Protect capital first"
          : targetDistancePct <= 2.5
            ? "Near target: prepare sell plan"
            : rsi >= 72
              ? "Strong but extended"
              : rr >= 2
                ? "Hold while plan stays valid"
                : "Track closely: reward/risk is tight";
  const checklist = [
    `Current trend reads ${trendState}; keep the trade only while price structure supports the plan.`,
    `Reward/risk is about ${rr.toFixed(1)}R from your entry to the generated target and stop.`,
    targetDistancePct <= 2.5
      ? "Price is close to the target zone, so decide whether to trim, sell, or trail before it gets there."
      : "Do not chase or add unless the reward/risk still improves from the new price.",
    stopDistancePct <= 3
      ? "Price is close to the stop, so review whether the setup is failing instead of widening risk."
      : "Keep the original stop visible; moving it lower usually turns a planned swing into an unplanned hold.",
  ];
  const invalidationSignals = [
    `Price closes below ${roundPrice(args.stopLoss)} or trades through the saved stop.`,
    `Price loses the trailing protection area near ${trailingStop}.`,
    "The stock weakens while SPY/QQQ or its sector are improving.",
    "A new earnings, SEC filing, downgrade, or major news event changes the setup.",
  ];

  return {
    actionLabel,
    actionTone,
    checklist,
    confidence: args.confidence,
    currentPrice: args.currentPrice,
    dataQuality: args.dataQuality,
    explanation: args.explanation,
    holdingPeriodDays: args.holdingPeriodDays,
    invalidationSignals,
    rewardRiskRatio: Number(rr.toFixed(2)),
    source: args.source,
    stopLoss: roundPrice(args.stopLoss),
    takeProfitZoneHigh,
    takeProfitZoneLow,
    targetPrice: roundPrice(args.targetPrice),
    trailingStop,
    trendState,
  } satisfies PortfolioExitPlan;
}

async function buildDailyAnalysisPlan(symbol: string, entryPrice: number) {
  const [result, profile, candles] = await Promise.all([
    getOpportunityBySymbol(symbol),
    getFmpCompanyProfile(symbol).catch(() => null),
    getFmpHistoricalCandles(symbol, isoDateDaysAgo(90), todayIsoDate()).catch(() => []),
  ]);
  const opportunity = result.rows[0];

  if (!opportunity) return null;

  const targetPrice = roundPrice(opportunity.target_price);
  const stopLoss = roundPrice(opportunity.stop_loss);

  if (targetPrice <= entryPrice || stopLoss >= entryPrice) return null;

  const currentPrice = Number(profile?.price);

  return buildPlanGuidance({
    candles,
    confidence: "higher",
    currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
    dataQuality: "daily_analysis",
    explanation:
      "This plan uses the latest saved SwingFi analysis for the ticker, so the target, stop, and review window match the research plan customers saw in the daily rankings.",
    holdingPeriodDays: opportunity.holding_period_days || 10,
    source: "swingfi_daily_analysis",
    stopLoss,
    targetPrice,
    entryPrice,
  });
}

async function buildMarketStructurePlan(symbol: string, entryPrice: number) {
  const [profile, candles] = await Promise.all([
    getFmpCompanyProfile(symbol).catch(() => null),
    getFmpHistoricalCandles(symbol, isoDateDaysAgo(75), todayIsoDate()).catch(() => []),
  ]);
  const currentPrice = Number(profile?.price);
  const referencePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : entryPrice;
  const sortedCandles = sortCandlesAscending(candles) as FmpHistoricalCandle[];
  const recentCandles = sortedCandles.slice(-45);
  const recentHigh = Math.max(
    ...numberValues(recentCandles.map((candle) => candle.high)),
    entryPrice * 1.04,
  );
  const recentLow = Math.min(
    ...numberValues(recentCandles.map((candle) => candle.low)),
    entryPrice * 0.94,
  );
  const avgRange = priceRangeAverage(recentCandles);
  const estimatedAtrPct = avgRange > 0 ? clamp(avgRange / referencePrice, 0.015, 0.08) : 0.035;
  const closes = numberValues(recentCandles.map((candle) => candle.close));
  const sma20 = simpleMovingAverage(closes, 20);
  const rsi = relativeStrengthIndex(closes);
  const trendState = trendStateFromCandles(sortedCandles, referencePrice);
  const trendMultiplier = trendState === "uptrend" ? 2.45 : trendState === "downtrend" ? 1.55 : 2.05;
  const extensionDrag = sma20 && referencePrice > sma20 * 1.08 ? 0.92 : 1;
  const overboughtDrag = rsi >= 72 ? 0.94 : 1;
  const targetFromMomentum = Math.max(referencePrice, entryPrice) * (1 + estimatedAtrPct * 2.2);
  const adjustedMomentumTarget =
    Math.max(referencePrice, entryPrice) * (1 + estimatedAtrPct * trendMultiplier * extensionDrag * overboughtDrag);
  const targetFromResistance = recentHigh * 0.995;
  const rawTarget = Math.max(targetFromMomentum, adjustedMomentumTarget, targetFromResistance, entryPrice * 1.045);
  const targetPrice = roundPrice(clamp(rawTarget, entryPrice * 1.035, entryPrice * 1.18));
  const supportStop = Math.min(recentLow * 0.99, entryPrice * (1 - estimatedAtrPct * 1.35));
  const rawStop = Math.min(supportStop, entryPrice * 0.965);
  const stopLoss = roundPrice(clamp(rawStop, entryPrice * 0.84, entryPrice * 0.985));
  const holdingPeriodDays =
    trendState === "uptrend" && targetPrice / entryPrice > 1.1
      ? 16
      : trendState === "downtrend"
        ? 7
        : targetPrice / entryPrice > 1.1
          ? 12
          : 9;

  return buildPlanGuidance({
    candles: sortedCandles,
    confidence: "estimate",
    currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
    dataQuality: sortedCandles.length >= 35 ? "live_structure" : "limited_structure",
    explanation:
      "This is a market-structure estimate because the trade was not tied to today's SwingFi ranking. It uses recent range, trend, momentum, nearby resistance, current price, and a conservative invalidation area to create a sell-review plan. Confirm it against the chart before trading more capital.",
    entryPrice,
    holdingPeriodDays,
    source: "market_structure_estimate",
    stopLoss,
    targetPrice,
  });
}

export async function buildPortfolioExitPlan(args: {
  entryPrice: number;
  symbol: string;
}) {
  const symbol = args.symbol.trim().toUpperCase();
  const entryPrice = Number(args.entryPrice);

  if (!symbol) {
    throw new Error("Choose the ticker before building a sell plan.");
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error("Add your entry price before building a sell plan.");
  }

  const dailyAnalysisPlan = await buildDailyAnalysisPlan(symbol, entryPrice).catch(() => null);

  if (dailyAnalysisPlan) {
    return dailyAnalysisPlan;
  }

  return buildMarketStructurePlan(symbol, entryPrice);
}

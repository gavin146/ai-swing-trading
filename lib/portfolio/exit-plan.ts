import { getFmpCompanyProfile, getFmpHistoricalCandles } from "@/lib/providers/fmp";
import { getOpportunityBySymbol } from "@/lib/repositories/opportunities";

export type PortfolioExitPlanSource = "swingfi_daily_analysis" | "market_structure_estimate";

export type PortfolioExitPlan = {
  confidence: "higher" | "estimate";
  explanation: string;
  holdingPeriodDays: number;
  source: PortfolioExitPlanSource;
  stopLoss: number;
  targetPrice: number;
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

function priceRangeAverage(candles: Array<{ high?: number; low?: number }>) {
  return average(
    candles
      .map((candle) => Number(candle.high) - Number(candle.low))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
}

async function buildDailyAnalysisPlan(symbol: string, entryPrice: number) {
  const result = await getOpportunityBySymbol(symbol);
  const opportunity = result.rows[0];

  if (!opportunity) return null;

  const targetPrice = roundPrice(opportunity.target_price);
  const stopLoss = roundPrice(opportunity.stop_loss);

  if (targetPrice <= entryPrice || stopLoss >= entryPrice) return null;

  return {
    confidence: "higher",
    explanation:
      "This plan uses the latest saved SwingFi analysis for the ticker, so the target, stop, and review window match the research plan customers saw in the daily rankings.",
    holdingPeriodDays: opportunity.holding_period_days || 10,
    source: "swingfi_daily_analysis",
    stopLoss,
    targetPrice,
  } satisfies PortfolioExitPlan;
}

async function buildMarketStructurePlan(symbol: string, entryPrice: number) {
  const [profile, candles] = await Promise.all([
    getFmpCompanyProfile(symbol).catch(() => null),
    getFmpHistoricalCandles(symbol, isoDateDaysAgo(75), todayIsoDate()).catch(() => []),
  ]);
  const currentPrice = Number(profile?.price);
  const referencePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : entryPrice;
  const recentCandles = candles.slice(0, 45);
  const recentHigh = Math.max(
    ...recentCandles.map((candle) => Number(candle.high)).filter((value) => Number.isFinite(value) && value > 0),
    entryPrice * 1.04,
  );
  const recentLow = Math.min(
    ...recentCandles.map((candle) => Number(candle.low)).filter((value) => Number.isFinite(value) && value > 0),
    entryPrice * 0.94,
  );
  const avgRange = priceRangeAverage(recentCandles);
  const estimatedAtrPct = avgRange > 0 ? clamp(avgRange / referencePrice, 0.015, 0.08) : 0.035;
  const targetFromMomentum = Math.max(referencePrice, entryPrice) * (1 + estimatedAtrPct * 2.2);
  const targetFromResistance = recentHigh * 0.995;
  const rawTarget = Math.max(targetFromMomentum, targetFromResistance, entryPrice * 1.045);
  const targetPrice = roundPrice(clamp(rawTarget, entryPrice * 1.035, entryPrice * 1.18));
  const supportStop = Math.min(recentLow * 0.99, entryPrice * (1 - estimatedAtrPct * 1.35));
  const rawStop = Math.min(supportStop, entryPrice * 0.965);
  const stopLoss = roundPrice(clamp(rawStop, entryPrice * 0.84, entryPrice * 0.985));
  const holdingPeriodDays = targetPrice / entryPrice > 1.1 ? 14 : 10;

  return {
    confidence: "estimate",
    explanation:
      "This is a market-structure estimate because the trade was not tied to today's SwingFi ranking. It uses recent price range, nearby resistance, current price, and a conservative stop area to create a review plan. Confirm it against the chart before trading more capital.",
    holdingPeriodDays,
    source: "market_structure_estimate",
    stopLoss,
    targetPrice,
  } satisfies PortfolioExitPlan;
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

import { runFmpDailyRankingAgent } from "@/lib/agent";
import type { OpportunityRow } from "@/lib/database.types";
import { getFmpHistoricalCandles, type FmpHistoricalCandle } from "@/lib/providers/fmp";

export type PickOutcome = "target_hit" | "stop_hit" | "expired" | "no_data";

export type BacktestTrade = {
  asOf: string;
  symbol: string;
  rank: number;
  score: number;
  confidence: number;
  riskScore: number;
  entryDate: string | null;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  rewardRiskRatio: number;
  holdingPeriodDays: number;
  outcome: PickOutcome;
  exitDate: string | null;
  exitPrice: number | null;
  returnPct: number;
  maxGainPct: number;
  maxDrawdownPct: number;
};

export type BacktestSummary = {
  runId: string;
  generatedAt: string;
  symbols: string[];
  windowsTested: number;
  tradesTested: number;
  targetHitRate: number;
  stopHitRate: number;
  expiredRate: number;
  averageReturnPct: number;
  averageMaxGainPct: number;
  averageMaxDrawdownPct: number;
  averageRewardRiskRatio: number;
  averageScore: number;
  scoreBands: {
    label: string;
    count: number;
    targetHitRate: number;
    averageReturnPct: number;
    averageRiskScore: number;
  }[];
  learningFeedback: {
    confidence: "low" | "medium" | "high";
    summary: string;
    calibrationRules: string[];
    openAiInstruction: string;
  };
  trades: BacktestTrade[];
  notes: string[];
};

const defaultBacktestSymbols = [
  "NVDA",
  "MSFT",
  "AAPL",
  "AMZN",
  "GOOGL",
  "AMD",
  "META",
  "JPM",
  "V",
  "XOM",
  "LLY",
  "UNH",
];

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function daysAgo(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function daysAhead(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sortCandles(candles: FmpHistoricalCandle[]) {
  return candles
    .filter(
      (candle) =>
        candle.date &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function percentChange(current: number, base: number) {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) {
    return 0;
  }

  return ((current - base) / base) * 100;
}

function rewardRiskRatio(opportunity: OpportunityRow) {
  const reward = opportunity.target_price - opportunity.entry_low;
  const risk = opportunity.entry_low - opportunity.stop_loss;

  if (reward <= 0 || risk <= 0) {
    return 0;
  }

  return round(reward / risk, 2);
}

function findEntry(
  opportunity: OpportunityRow,
  futureCandles: FmpHistoricalCandle[],
) {
  for (const [index, candle] of futureCandles.entries()) {
    const low = candle.low ?? 0;
    const high = candle.high ?? 0;

    if (low <= opportunity.entry_high && high >= opportunity.entry_low) {
      return {
        index,
        date: candle.date,
        price: Math.min(
          opportunity.entry_high,
          Math.max(opportunity.entry_low, candle.close ?? opportunity.entry_low),
        ),
      };
    }
  }

  return null;
}

function evaluateTrade(args: {
  asOf: string;
  rank: number;
  opportunity: OpportunityRow;
  futureCandles: FmpHistoricalCandle[];
}) {
  const sorted = sortCandles(args.futureCandles);
  const entry = findEntry(args.opportunity, sorted);

  if (!entry) {
    return {
      asOf: args.asOf,
      symbol: args.opportunity.symbol,
      rank: args.rank,
      score: args.opportunity.score,
      confidence: args.opportunity.confidence,
      riskScore: args.opportunity.risk_score,
      entryDate: null,
      entryPrice: args.opportunity.entry_low,
      targetPrice: args.opportunity.target_price,
      stopLoss: args.opportunity.stop_loss,
      rewardRiskRatio: rewardRiskRatio(args.opportunity),
      holdingPeriodDays: args.opportunity.holding_period_days,
      outcome: "no_data",
      exitDate: null,
      exitPrice: null,
      returnPct: 0,
      maxGainPct: 0,
      maxDrawdownPct: 0,
    } satisfies BacktestTrade;
  }

  const entryPrice = entry.price;
  const evaluationCandles = sorted.slice(entry.index).filter((candle) => {
    const elapsedDays = daysBetween(new Date(entry.date), new Date(candle.date));
    return elapsedDays >= 0 && elapsedDays <= args.opportunity.holding_period_days;
  });
  let outcome: PickOutcome = "expired";
  let exitDate: string | null = null;
  let exitPrice = evaluationCandles.at(-1)?.close ?? entryPrice;
  let maxHigh = entryPrice;
  let minLow = entryPrice;

  for (const candle of evaluationCandles) {
    maxHigh = Math.max(maxHigh, candle.high ?? entryPrice);
    minLow = Math.min(minLow, candle.low ?? entryPrice);

    const stopHit = (candle.low ?? Infinity) <= args.opportunity.stop_loss;
    const targetHit = (candle.high ?? 0) >= args.opportunity.target_price;

    if (stopHit && targetHit) {
      outcome = "stop_hit";
      exitDate = candle.date;
      exitPrice = args.opportunity.stop_loss;
      break;
    }

    if (stopHit) {
      outcome = "stop_hit";
      exitDate = candle.date;
      exitPrice = args.opportunity.stop_loss;
      break;
    }

    if (targetHit) {
      outcome = "target_hit";
      exitDate = candle.date;
      exitPrice = args.opportunity.target_price;
      break;
    }
  }

  if (!exitDate) {
    exitDate = evaluationCandles.at(-1)?.date ?? entry.date;
  }

  return {
    asOf: args.asOf,
    symbol: args.opportunity.symbol,
    rank: args.rank,
    score: args.opportunity.score,
    confidence: args.opportunity.confidence,
    riskScore: args.opportunity.risk_score,
    entryDate: entry.date,
    entryPrice: round(entryPrice, 2),
    targetPrice: args.opportunity.target_price,
    stopLoss: args.opportunity.stop_loss,
    rewardRiskRatio: rewardRiskRatio(args.opportunity),
    holdingPeriodDays: args.opportunity.holding_period_days,
    outcome,
    exitDate,
    exitPrice: round(exitPrice, 2),
    returnPct: round(percentChange(exitPrice, entryPrice), 2),
    maxGainPct: round(percentChange(maxHigh, entryPrice), 2),
    maxDrawdownPct: round(percentChange(minLow, entryPrice), 2),
  } satisfies BacktestTrade;
}

function scoreBand(score: number) {
  if (score >= 80) return "80+";
  if (score >= 70) return "70-79";
  if (score >= 60) return "60-69";
  return "Below 60";
}

function buildScoreBands(trades: BacktestTrade[]) {
  const labels = ["80+", "70-79", "60-69", "Below 60"];

  return labels.map((label) => {
    const bandTrades = trades.filter((trade) => scoreBand(trade.score) === label);
    const targetHits = bandTrades.filter((trade) => trade.outcome === "target_hit").length;

    return {
      label,
      count: bandTrades.length,
      targetHitRate: bandTrades.length ? round((targetHits / bandTrades.length) * 100) : 0,
      averageReturnPct: round(average(bandTrades.map((trade) => trade.returnPct)), 2),
      averageRiskScore: round(average(bandTrades.map((trade) => trade.riskScore)), 1),
    };
  });
}

function buildLearningFeedback(args: {
  trades: BacktestTrade[];
  scoreBands: BacktestSummary["scoreBands"];
  targetHitRate: number;
  stopHitRate: number;
  averageReturnPct: number;
}) {
  const highScoreTrades = args.trades.filter((trade) => trade.score >= 70);
  const highScoreStopRate = highScoreTrades.length
    ? (highScoreTrades.filter((trade) => trade.outcome === "stop_hit").length /
        highScoreTrades.length) *
      100
    : 0;
  const weakBandOutperforming = args.scoreBands.find(
    (band) => band.label === "Below 60" && band.count >= 3 && band.averageReturnPct > 0,
  );
  const rules: string[] = [];

  if (highScoreStopRate >= 25) {
    rules.push(
      "Reduce confidence on high-score setups when recent stop-out rates are elevated; require cleaner support distance and lower event risk before labeling them high conviction.",
    );
  }

  if (args.stopHitRate >= 30) {
    rules.push(
      "Penalize setups with tight entry-to-stop distance when volatility is expanding because recent backtests show higher stop-out risk.",
    );
  }

  if (args.targetHitRate < 45) {
    rules.push(
      "Be more conservative on targets and do not overstate upside when recent target-hit rates are below acceptable swing-trading thresholds.",
    );
  }

  if (weakBandOutperforming) {
    rules.push(
      "Investigate why lower score-band trades produced positive returns; avoid dismissing moderate-score setups when reward/risk and drawdown behavior are strong.",
    );
  }

  if (args.averageReturnPct <= 0) {
    rules.push(
      "Tighten ranking thresholds because the tested basket did not produce positive average returns.",
    );
  }

  if (rules.length === 0) {
    rules.push(
      "Keep the current weighting stable, but continue monitoring score bands before increasing confidence language.",
    );
  }

  const confidence =
    args.trades.length >= 60 ? "high" : args.trades.length >= 25 ? "medium" : "low";
  const summary = `Backtest learning confidence is ${confidence}; ${args.trades.length} usable trades showed ${args.targetHitRate}% target hits, ${args.stopHitRate}% stop hits, and ${args.averageReturnPct}% average return.`;

  return {
    confidence,
    summary,
    calibrationRules: rules,
    openAiInstruction:
      "Use the backtest calibration rules as guardrails. When explaining picks, explicitly lower conviction where recent similar setups stopped out, avoid promising precision, and highlight what must improve before a trade deserves higher confidence.",
  } satisfies BacktestSummary["learningFeedback"];
}

export async function runRollingBacktest(args: {
  windows?: number;
  intervalDays?: number;
  limitPerWindow?: number;
  symbols?: string[];
} = {}) {
  const windows = Math.max(1, Math.min(args.windows ?? 5, 8));
  const intervalDays = Math.max(7, Math.min(args.intervalDays ?? 21, 45));
  const limitPerWindow = Math.max(1, Math.min(args.limitPerWindow ?? 6, 12));
  const symbols = args.symbols?.length ? args.symbols : defaultBacktestSymbols;
  const today = new Date();
  const asOfDates = Array.from({ length: windows }, (_, index) =>
    daysAgo(today, (index + 2) * intervalDays),
  ).reverse();
  const trades: BacktestTrade[] = [];

  for (const asOf of asOfDates) {
    const result = await runFmpDailyRankingAgent({
      asOf,
      limit: limitPerWindow,
      symbols,
    });

    for (const ranking of result.rankings.slice(0, limitPerWindow)) {
      const from = formatDate(daysAhead(asOf, 1));
      const to = formatDate(daysAhead(asOf, ranking.opportunity.holding_period_days + 10));
      const futureCandles = await getFmpHistoricalCandles(ranking.opportunity.symbol, from, to);

      trades.push(
        evaluateTrade({
          asOf: formatDate(asOf),
          rank: ranking.rank,
          opportunity: ranking.opportunity,
          futureCandles,
        }),
      );
    }
  }

  const usableTrades = trades.filter((trade) => trade.outcome !== "no_data");
  const targetHits = usableTrades.filter((trade) => trade.outcome === "target_hit").length;
  const stopHits = usableTrades.filter((trade) => trade.outcome === "stop_hit").length;
  const expired = usableTrades.filter((trade) => trade.outcome === "expired").length;

  const scoreBands = buildScoreBands(usableTrades);
  const targetHitRate = usableTrades.length ? round((targetHits / usableTrades.length) * 100) : 0;
  const stopHitRate = usableTrades.length ? round((stopHits / usableTrades.length) * 100) : 0;
  const averageReturnPct = round(average(usableTrades.map((trade) => trade.returnPct)), 2);

  return {
    runId: `backtest-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    symbols,
    windowsTested: windows,
    tradesTested: usableTrades.length,
    targetHitRate,
    stopHitRate,
    expiredRate: usableTrades.length ? round((expired / usableTrades.length) * 100) : 0,
    averageReturnPct,
    averageMaxGainPct: round(average(usableTrades.map((trade) => trade.maxGainPct)), 2),
    averageMaxDrawdownPct: round(average(usableTrades.map((trade) => trade.maxDrawdownPct)), 2),
    averageRewardRiskRatio: round(
      average(usableTrades.map((trade) => trade.rewardRiskRatio)),
      2,
    ),
    averageScore: round(average(usableTrades.map((trade) => trade.score)), 1),
    scoreBands,
    learningFeedback: buildLearningFeedback({
      trades: usableTrades,
      scoreBands,
      targetHitRate,
      stopHitRate,
      averageReturnPct,
    }),
    trades: usableTrades,
    notes: [
      "This is a rolling historical outcome simulation using FMP candles and the current ranking engine.",
      "The simulator only evaluates target/stop movement after the entry range is touched, then expires the trade at the modeled holding period.",
      "Current fundamentals/news availability may not be perfectly point-in-time, so this is a reliability screen rather than institutional-grade research backtesting.",
      "If target and stop are both touched in the same candle, the backtest conservatively counts the stop first.",
      "This is not proof of future performance; it is the first verification layer for measuring whether scores have predictive value.",
    ],
  } satisfies BacktestSummary;
}

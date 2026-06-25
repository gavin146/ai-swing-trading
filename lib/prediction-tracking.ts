import type { PredictionOutcomeRow, PredictionStatus } from "@/lib/database.types";
import type { RankingCalibrationRule } from "@/lib/agent/calibration";
import { getFmpHistoricalCandles, type FmpHistoricalCandle } from "@/lib/providers/fmp";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type PredictionScoreBand = {
  averageExcessReturnPct: number;
  averageReturnPct: number;
  count: number;
  label: string;
  targetHitRate: number;
};

export type PredictionAccuracySummary = {
  averageExcessReturnPct: number;
  averageMaxDrawdownPct: number;
  averageMaxGainPct: number;
  averageQqqReturnPct: number;
  averageReturnPct: number;
  averageSpyReturnPct: number;
  evaluatedCount: number;
  expiredCount: number;
  generatedAt: string;
  latestPredictionDate: string | null;
  noEntryCount: number;
  openCount: number;
  pendingCount: number;
  predictions: PredictionOutcomeRow[];
  scoreBands: PredictionScoreBand[];
  source: "supabase" | "empty";
  stopHitCount: number;
  stopHitRate: number;
  targetHitCount: number;
  targetHitRate: number;
  totalPredictions: number;
  updatedCount: number;
  calibrationGeneratedCount: number;
  calibrationStatus: "active" | "insufficient_sample" | "not_configured";
  verificationMessage: string;
};

type EvaluationResult = Partial<PredictionOutcomeRow> & {
  status: PredictionStatus;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isMissingPredictionTableError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";

  return message.includes("prediction_outcomes") && (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

function emptySummary(verificationMessage: string): PredictionAccuracySummary {
  return {
    averageExcessReturnPct: 0,
    averageMaxDrawdownPct: 0,
    averageMaxGainPct: 0,
    averageQqqReturnPct: 0,
    averageReturnPct: 0,
    averageSpyReturnPct: 0,
    evaluatedCount: 0,
    expiredCount: 0,
    generatedAt: new Date().toISOString(),
    latestPredictionDate: null,
    noEntryCount: 0,
    openCount: 0,
    pendingCount: 0,
    predictions: [],
    scoreBands: buildScoreBands([]),
    source: "empty",
    stopHitCount: 0,
    stopHitRate: 0,
    targetHitCount: 0,
    targetHitRate: 0,
    totalPredictions: 0,
    updatedCount: 0,
    calibrationGeneratedCount: 0,
    calibrationStatus: "not_configured",
    verificationMessage,
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAhead(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return formatDate(next);
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  return Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
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

function findEntry(prediction: PredictionOutcomeRow, candles: FmpHistoricalCandle[]) {
  for (const [index, candle] of candles.entries()) {
    const low = candle.low ?? 0;
    const high = candle.high ?? 0;

    if (low <= prediction.entry_high && high >= prediction.entry_low) {
      return {
        date: candle.date,
        index,
        price: Math.min(
          prediction.entry_high,
          Math.max(prediction.entry_low, candle.close ?? prediction.entry_low),
        ),
      };
    }
  }

  return null;
}

function candleReturn(candles: FmpHistoricalCandle[]) {
  const sorted = sortCandles(candles);
  const first = sorted[0]?.close;
  const last = sorted.at(-1)?.close;

  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return null;
  }

  return round(percentChange(Number(last), Number(first)), 2);
}

async function benchmarkReturn(symbol: "QQQ" | "SPY", from: string, to: string) {
  try {
    return candleReturn(await getFmpHistoricalCandles(symbol, from, to));
  } catch {
    return null;
  }
}

async function evaluatePrediction(prediction: PredictionOutcomeRow): Promise<EvaluationResult> {
  const today = formatDate(new Date());
  const from = daysAhead(prediction.prediction_date, 1);
  const plannedEnd = daysAhead(prediction.prediction_date, prediction.holding_period_days + 2);
  const to = today < plannedEnd ? today : plannedEnd;
  const candles = sortCandles(await getFmpHistoricalCandles(prediction.symbol, from, to).catch(() => []));

  if (candles.length === 0) {
    return {
      evaluated_at: new Date().toISOString(),
      status: daysBetween(prediction.prediction_date, today) > prediction.holding_period_days
        ? "no_data"
        : prediction.status,
    };
  }

  const entry = findEntry(prediction, candles);

  if (!entry) {
    const matured = daysBetween(prediction.prediction_date, today) > prediction.holding_period_days;
    const spyReturn = await benchmarkReturn("SPY", prediction.prediction_date, to);
    const qqqReturn = await benchmarkReturn("QQQ", prediction.prediction_date, to);
    const benchmark = average([spyReturn, qqqReturn].filter((value) => value !== null));

    return {
      benchmark_return_pct: benchmark || null,
      evaluated_at: new Date().toISOString(),
      excess_return_pct: benchmark ? round(0 - benchmark, 2) : null,
      qqq_return_pct: qqqReturn,
      spy_return_pct: spyReturn,
      status: matured ? "no_entry" : "pending",
      updated_at: new Date().toISOString(),
    };
  }

  const entryPrice = entry.price;
  const evaluationCandles = candles.slice(entry.index).filter((candle) => {
    const elapsedDays = daysBetween(entry.date, candle.date);
    return elapsedDays >= 0 && elapsedDays <= prediction.holding_period_days;
  });
  let status: PredictionStatus = "entered";
  let exitDate: string | null = null;
  let exitPrice = evaluationCandles.at(-1)?.close ?? entryPrice;
  let maxHigh = entryPrice;
  let minLow = entryPrice;

  for (const candle of evaluationCandles) {
    maxHigh = Math.max(maxHigh, candle.high ?? entryPrice);
    minLow = Math.min(minLow, candle.low ?? entryPrice);

    const stopHit = (candle.low ?? Infinity) <= prediction.stop_loss;
    const targetHit = (candle.high ?? 0) >= prediction.target_price;

    if (stopHit && targetHit) {
      status = "stop_hit";
      exitDate = candle.date;
      exitPrice = prediction.stop_loss;
      break;
    }

    if (stopHit) {
      status = "stop_hit";
      exitDate = candle.date;
      exitPrice = prediction.stop_loss;
      break;
    }

    if (targetHit) {
      status = "target_hit";
      exitDate = candle.date;
      exitPrice = prediction.target_price;
      break;
    }
  }

  if (!exitDate && daysBetween(entry.date, today) >= prediction.holding_period_days) {
    status = "expired";
    exitDate = evaluationCandles.at(-1)?.date ?? entry.date;
  }

  const benchmarkTo = exitDate ?? to;
  const spyReturn = await benchmarkReturn("SPY", prediction.prediction_date, benchmarkTo);
  const qqqReturn = await benchmarkReturn("QQQ", prediction.prediction_date, benchmarkTo);
  const benchmarkValues = [spyReturn, qqqReturn].filter((value) => value !== null);
  const benchmark = benchmarkValues.length ? round(average(benchmarkValues), 2) : null;
  const returnPct = round(percentChange(exitPrice, entryPrice), 2);

  return {
    benchmark_return_pct: benchmark,
    entry_date: entry.date,
    entry_price: round(entryPrice, 2),
    evaluated_at: new Date().toISOString(),
    excess_return_pct: benchmark !== null ? round(returnPct - benchmark, 2) : null,
    exit_date: exitDate,
    exit_price: exitDate ? round(exitPrice, 2) : null,
    max_drawdown_pct: round(percentChange(minLow, entryPrice), 2),
    max_gain_pct: round(percentChange(maxHigh, entryPrice), 2),
    qqq_return_pct: qqqReturn,
    return_pct: returnPct,
    spy_return_pct: spyReturn,
    status,
    updated_at: new Date().toISOString(),
  };
}

function scoreBand(score: number) {
  if (score >= 80) return "80+";
  if (score >= 70) return "70-79";
  if (score >= 60) return "60-69";
  return "Below 60";
}

function buildScoreBands(predictions: PredictionOutcomeRow[]) {
  const labels = ["80+", "70-79", "60-69", "Below 60"];

  return labels.map((label) => {
    const band = predictions.filter((prediction) => scoreBand(prediction.score) === label);
    const targetHits = band.filter((prediction) => prediction.status === "target_hit").length;

    return {
      averageExcessReturnPct: round(average(band.map((prediction) => prediction.excess_return_pct ?? 0)), 2),
      averageReturnPct: round(average(band.map((prediction) => prediction.return_pct)), 2),
      count: band.length,
      label,
      targetHitRate: band.length ? round((targetHits / band.length) * 100, 1) : 0,
    } satisfies PredictionScoreBand;
  });
}

function usableOutcome(prediction: PredictionOutcomeRow) {
  return ["target_hit", "stop_hit", "expired", "no_entry"].includes(prediction.status);
}

function hitRate(predictions: PredictionOutcomeRow[], status: PredictionStatus) {
  return predictions.length
    ? round((predictions.filter((prediction) => prediction.status === status).length / predictions.length) * 100, 1)
    : 0;
}

function confidenceForSample(sampleSize: number): RankingCalibrationRule["confidence"] {
  if (sampleSize >= 80) return "high";
  if (sampleSize >= 35) return "medium";
  return "low";
}

function buildForwardCalibrationRules(predictions: PredictionOutcomeRow[]) {
  const usable = predictions.filter(usableOutcome);
  const generatedAt = new Date().toISOString();
  const confidence = confidenceForSample(usable.length);
  const rules: RankingCalibrationRule[] = [];

  if (usable.length < 15) {
    return rules;
  }

  const targetHitRate = hitRate(usable, "target_hit");
  const stopHitRate = hitRate(usable, "stop_hit");
  const averageReturnPct = round(average(usable.map((prediction) => prediction.return_pct)), 2);
  const averageExcessReturnPct = round(average(usable.map((prediction) => prediction.excess_return_pct ?? 0)), 2);
  const highScore = usable.filter((prediction) => prediction.score >= 75);
  const highScoreStopRate = hitRate(highScore, "stop_hit");
  const tightOrHighRisk = usable.filter(
    (prediction) =>
      prediction.expected_loss <= 5 ||
      prediction.risk_score >= 55 ||
      prediction.reward_risk_ratio < 1.8,
  );
  const tightStopRate = hitRate(tightOrHighRisk, "stop_hit");
  const highConfidenceMisses = usable.filter(
    (prediction) =>
      prediction.confidence >= 75 &&
      prediction.status !== "target_hit" &&
      (prediction.return_pct <= 0 || (prediction.excess_return_pct ?? 0) <= 0),
  );

  if (highScore.length >= 8 && (highScoreStopRate >= 24 || averageExcessReturnPct < -1)) {
    rules.push({
      id: `forward-high-score-stop-guard-${Date.now()}`,
      ruleKey: "high_score_stop_out_guard",
      label: "Forward high-score guard",
      description:
        "Live outcome tracking showed high-score picks still need cleaner risk confirmation before reaching top customer rankings.",
      triggerDescription: "Raw score >= 70 and risk >= 52, ATR >= 5.5%, or at least one news risk flag.",
      scorePenalty: highScoreStopRate >= 35 ? 7 : 5,
      confidencePenalty: highScoreStopRate >= 35 ? 7 : 5,
      riskAdjustment: highScoreStopRate >= 35 ? 8 : 5,
      sampleSize: highScore.length,
      targetHitRate,
      stopHitRate: highScoreStopRate,
      averageReturnPct,
      confidence,
      active: true,
      source: "forward",
      createdAt: generatedAt,
    });
  }

  if (tightOrHighRisk.length >= 8 && tightStopRate >= Math.max(25, targetHitRate - 2)) {
    rules.push({
      id: `forward-tight-stop-volatility-${Date.now()}`,
      ruleKey: "tight_stop_volatility",
      label: "Forward stop pressure guard",
      description:
        "Live predictions with tight downside, weaker reward/risk, or elevated risk stopped out too often, so similar setups receive a bigger risk haircut.",
      triggerDescription: "ATR >= 5.5% and price is within 5.5% of modeled support.",
      scorePenalty: tightStopRate >= 35 ? 6 : 4,
      confidencePenalty: 5,
      riskAdjustment: tightStopRate >= 35 ? 8 : 6,
      sampleSize: tightOrHighRisk.length,
      targetHitRate,
      stopHitRate: tightStopRate,
      averageReturnPct,
      confidence,
      active: true,
      source: "forward",
      createdAt: generatedAt,
    });
  }

  if (targetHitRate < 38 || averageExcessReturnPct < 0) {
    rules.push({
      id: `forward-target-conservatism-${Date.now()}`,
      ruleKey: "low_target_hit_conservatism",
      label: "Forward target realism",
      description:
        "Live predictions have not hit targets or beaten benchmarks often enough, so stretched targets are discounted until outcomes improve.",
      triggerDescription: "Raw score >= 68 with modeled resistance more than 12% above current price.",
      scorePenalty: targetHitRate < 30 ? 5 : 3,
      confidencePenalty: 4,
      riskAdjustment: 3,
      sampleSize: usable.length,
      targetHitRate,
      stopHitRate,
      averageReturnPct,
      confidence,
      active: true,
      source: "forward",
      createdAt: generatedAt,
    });
  }

  if (highConfidenceMisses.length >= 8) {
    rules.push({
      id: `forward-high-confidence-miss-${Date.now()}`,
      ruleKey: "weak_quality_drag",
      label: "Forward confidence reality check",
      description:
        "Live tracking found confident setups that failed to produce return, so confidence now needs broader technical, catalyst, and risk agreement.",
      triggerDescription: "Technical score >= 68 and financial score below 48.",
      scorePenalty: 3,
      confidencePenalty: 5,
      riskAdjustment: 3,
      sampleSize: highConfidenceMisses.length,
      targetHitRate,
      stopHitRate,
      averageReturnPct,
      confidence,
      active: true,
      source: "forward",
      createdAt: generatedAt,
    });
  }

  return rules;
}

function toRuleInsert(rule: RankingCalibrationRule) {
  return {
    source_backtest_run_id: null,
    rule_key: rule.ruleKey,
    label: rule.label,
    description: rule.description,
    trigger_config: {
      ruleKey: rule.ruleKey,
      source: "forward_prediction_outcomes",
    },
    trigger_description: rule.triggerDescription,
    score_penalty: rule.scorePenalty,
    confidence_penalty: rule.confidencePenalty,
    risk_adjustment: rule.riskAdjustment,
    sample_size: rule.sampleSize,
    target_hit_rate: rule.targetHitRate,
    stop_hit_rate: rule.stopHitRate,
    average_return_pct: rule.averageReturnPct,
    confidence: rule.confidence,
    active: rule.active,
  };
}

function summarize(predictions: PredictionOutcomeRow[], updatedCount: number): PredictionAccuracySummary {
  const evaluated = predictions.filter((prediction) =>
    ["target_hit", "stop_hit", "expired", "no_entry", "no_data"].includes(prediction.status),
  );
  const targetHitCount = evaluated.filter((prediction) => prediction.status === "target_hit").length;
  const stopHitCount = evaluated.filter((prediction) => prediction.status === "stop_hit").length;
  const expiredCount = evaluated.filter((prediction) => prediction.status === "expired").length;
  const noEntryCount = evaluated.filter((prediction) => prediction.status === "no_entry").length;
  const openCount = predictions.filter((prediction) => prediction.status === "entered").length;
  const pendingCount = predictions.filter((prediction) => prediction.status === "pending").length;
  const latestPredictionDate =
    predictions
      .map((prediction) => prediction.prediction_date)
      .sort()
      .at(-1) ?? null;

  return {
    averageExcessReturnPct: round(average(evaluated.map((prediction) => prediction.excess_return_pct ?? 0)), 2),
    averageMaxDrawdownPct: round(average(evaluated.map((prediction) => prediction.max_drawdown_pct)), 2),
    averageMaxGainPct: round(average(evaluated.map((prediction) => prediction.max_gain_pct)), 2),
    averageQqqReturnPct: round(average(evaluated.map((prediction) => prediction.qqq_return_pct ?? 0)), 2),
    averageReturnPct: round(average(evaluated.map((prediction) => prediction.return_pct)), 2),
    averageSpyReturnPct: round(average(evaluated.map((prediction) => prediction.spy_return_pct ?? 0)), 2),
    evaluatedCount: evaluated.length,
    expiredCount,
    generatedAt: new Date().toISOString(),
    latestPredictionDate,
    noEntryCount,
    openCount,
    pendingCount,
    predictions,
    scoreBands: buildScoreBands(evaluated),
    source: "supabase",
    stopHitCount,
    stopHitRate: evaluated.length ? round((stopHitCount / evaluated.length) * 100, 1) : 0,
    targetHitCount,
    targetHitRate: evaluated.length ? round((targetHitCount / evaluated.length) * 100, 1) : 0,
    totalPredictions: predictions.length,
    updatedCount,
    calibrationGeneratedCount: buildForwardCalibrationRules(evaluated).length,
    calibrationStatus: evaluated.length >= 15 ? "active" : "insufficient_sample",
    verificationMessage:
      evaluated.length >= 60
        ? "Forward tracking has a meaningful early sample, but it still should not be marketed as guaranteed prediction."
        : "Forward tracking is active, but more live predictions are needed before making strong performance claims.",
  };
}

export async function persistForwardCalibrationFromPredictions(limit = 500) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      generatedCount: 0,
      persisted: false,
      reason: "Supabase service role is not configured.",
    };
  }

  const summary = await getPredictionAccuracySummary(limit);
  const rules = buildForwardCalibrationRules(summary.predictions);

  if (rules.length === 0) {
    return {
      generatedCount: 0,
      persisted: true,
      reason: "Not enough evaluated live predictions to generate forward calibration rules yet.",
      summary,
    };
  }

  const { error: deactivateError } = await supabase
    .from("ranking_calibration_rules")
    .update({ active: false, updated_at: new Date().toISOString() })
    .is("source_backtest_run_id", null)
    .eq("active", true);

  if (deactivateError) {
    throw new Error(deactivateError.message);
  }

  const { error: insertError } = await supabase
    .from("ranking_calibration_rules")
    .insert(rules.map(toRuleInsert));

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    generatedCount: rules.length,
    persisted: true,
    rules,
    summary,
  };
}

export async function getPredictionAccuracySummary(limit = 300) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return emptySummary("Supabase persistence is required for forward prediction tracking.");
  }

  const { data, error } = await supabase
    .from("prediction_outcomes")
    .select("*")
    .order("prediction_date", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingPredictionTableError(error)) {
      return emptySummary(
        "Prediction tracking is coded, but the prediction_outcomes table has not been applied in Supabase yet.",
      );
    }

    throw new Error(error.message);
  }

  return summarize((data ?? []) as PredictionOutcomeRow[], 0);
}

export async function evaluatePendingPredictions(limit = 80) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return getPredictionAccuracySummary();
  }

  const { data, error } = await supabase
    .from("prediction_outcomes")
    .select("*")
    .in("status", ["pending", "entered"])
    .order("prediction_date", { ascending: true })
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingPredictionTableError(error)) {
      return emptySummary(
        "Prediction tracking is coded, but the prediction_outcomes table has not been applied in Supabase yet.",
      );
    }

    throw new Error(error.message);
  }

  let updatedCount = 0;

  for (const prediction of (data ?? []) as PredictionOutcomeRow[]) {
    const evaluation = await evaluatePrediction(prediction);
    const { error: updateError } = await supabase
      .from("prediction_outcomes")
      .update(evaluation)
      .eq("id", prediction.id);

    if (!updateError) {
      updatedCount += 1;
    }
  }

  const summary = await getPredictionAccuracySummary();
  return {
    ...summary,
    updatedCount,
  } satisfies PredictionAccuracySummary;
}

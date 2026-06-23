import type {
  AppliedCalibrationRule,
  EquityCandidate,
  ScoreBreakdown,
} from "./types";

export type CalibrationRuleKey =
  | "high_score_stop_out_guard"
  | "tight_stop_volatility"
  | "low_target_hit_conservatism"
  | "event_risk_drag"
  | "weak_quality_drag";

export type RankingCalibrationRule = {
  id: string;
  ruleKey: CalibrationRuleKey;
  label: string;
  description: string;
  triggerDescription: string;
  scorePenalty: number;
  confidencePenalty: number;
  riskAdjustment: number;
  sampleSize: number;
  targetHitRate: number;
  stopHitRate: number;
  averageReturnPct: number;
  confidence: "low" | "medium" | "high";
  active: boolean;
  source: "default" | "backtest" | "environment";
  createdAt: string;
};

type BacktestCalibrationInput = {
  trades: {
    score: number;
    riskScore: number;
    outcome: "target_hit" | "stop_hit" | "expired" | "no_data";
    returnPct: number;
    maxDrawdownPct: number;
    rewardRiskRatio: number;
  }[];
  targetHitRate: number;
  stopHitRate: number;
  averageReturnPct: number;
};

const createdAt = "2026-06-22T00:00:00.000Z";

const defaultCalibrationRules: RankingCalibrationRule[] = [
  {
    id: "default-high-score-stop-guard",
    ruleKey: "high_score_stop_out_guard",
    label: "High score stop-out guard",
    description:
      "Lower conviction when a high raw score also has elevated volatility, risk flags, or risk score pressure.",
    triggerDescription: "Raw score >= 70 and risk >= 52, ATR >= 5.5%, or at least one news risk flag.",
    scorePenalty: 3,
    confidencePenalty: 4,
    riskAdjustment: 4,
    sampleSize: 0,
    targetHitRate: 0,
    stopHitRate: 0,
    averageReturnPct: 0,
    confidence: "low",
    active: true,
    source: "default",
    createdAt,
  },
  {
    id: "default-tight-stop-volatility",
    ruleKey: "tight_stop_volatility",
    label: "Volatility near support",
    description:
      "Penalize setups where volatility is expanding while price is still close to support.",
    triggerDescription: "ATR >= 5.5% and price is within 5.5% of modeled support.",
    scorePenalty: 4,
    confidencePenalty: 4,
    riskAdjustment: 6,
    sampleSize: 0,
    targetHitRate: 0,
    stopHitRate: 0,
    averageReturnPct: 0,
    confidence: "low",
    active: true,
    source: "default",
    createdAt,
  },
  {
    id: "default-event-risk-drag",
    ruleKey: "event_risk_drag",
    label: "Catalyst risk drag",
    description:
      "Reduce score when news contains multiple risk flags or weak sentiment.",
    triggerDescription: "Two or more news risk flags, or sentiment below 45 with at least one risk flag.",
    scorePenalty: 4,
    confidencePenalty: 5,
    riskAdjustment: 6,
    sampleSize: 0,
    targetHitRate: 0,
    stopHitRate: 0,
    averageReturnPct: 0,
    confidence: "low",
    active: true,
    source: "default",
    createdAt,
  },
];

let runtimeCalibrationRules: RankingCalibrationRule[] | null = null;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function supportDistancePct(candidate: EquityCandidate) {
  const { price, support } = candidate.technical;

  if (!Number.isFinite(price) || !Number.isFinite(support) || price <= 0) {
    return 100;
  }

  return ((price - support) / price) * 100;
}

function resistanceDistancePct(candidate: EquityCandidate) {
  const { price, resistance } = candidate.technical;

  if (!Number.isFinite(price) || !Number.isFinite(resistance) || price <= 0) {
    return 0;
  }

  return ((resistance - price) / price) * 100;
}

function parseEnvironmentRules() {
  const raw = process.env.BACKTEST_CALIBRATION_TABLE;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RankingCalibrationRule[];

    return parsed
      .filter((rule) => rule?.id && rule?.ruleKey && rule.active)
      .map((rule) => ({
        ...rule,
        source: "environment" as const,
      }));
  } catch {
    return [];
  }
}

export function getActiveCalibrationRules() {
  const environmentRules = parseEnvironmentRules();

  if (environmentRules.length > 0) {
    return environmentRules;
  }

  if (runtimeCalibrationRules?.length) {
    return runtimeCalibrationRules;
  }

  return defaultCalibrationRules;
}

export function setRuntimeCalibrationRules(rules: RankingCalibrationRule[]) {
  const activeRules = rules.filter((rule) => rule.active);

  runtimeCalibrationRules = activeRules.length > 0 ? activeRules : null;

  return getActiveCalibrationRules();
}

function matchesCalibrationRule(
  rule: RankingCalibrationRule,
  candidate: EquityCandidate,
  scores: ScoreBreakdown,
) {
  const distanceToSupport = supportDistancePct(candidate);

  switch (rule.ruleKey) {
    case "high_score_stop_out_guard":
      return (
        scores.composite >= 70 &&
        (scores.risk >= 52 ||
          candidate.technical.atrPercent >= 5.5 ||
          candidate.news.riskFlagCount >= 1)
      );
    case "tight_stop_volatility":
      return candidate.technical.atrPercent >= 5.5 && distanceToSupport <= 5.5;
    case "low_target_hit_conservatism":
      return scores.composite >= 68 && resistanceDistancePct(candidate) >= 12;
    case "event_risk_drag":
      return (
        candidate.news.riskFlagCount >= 2 ||
        (candidate.news.sentimentScore < 45 && candidate.news.riskFlagCount >= 1)
      );
    case "weak_quality_drag":
      return scores.technical >= 68 && scores.financial < 48;
    default:
      return false;
  }
}

export function applyScoreCalibration(
  candidate: EquityCandidate,
  rawScores: ScoreBreakdown,
  rules = getActiveCalibrationRules(),
) {
  const appliedRules: AppliedCalibrationRule[] = rules
    .filter((rule) => rule.active && matchesCalibrationRule(rule, candidate, rawScores))
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      reason: rule.description,
      scorePenalty: rule.scorePenalty,
      confidencePenalty: rule.confidencePenalty,
      riskAdjustment: rule.riskAdjustment,
    }));

  const totalScorePenalty = Math.min(
    14,
    appliedRules.reduce((total, rule) => total + rule.scorePenalty, 0),
  );
  const totalConfidencePenalty = Math.min(
    16,
    appliedRules.reduce((total, rule) => total + rule.confidencePenalty, 0),
  );
  const totalRiskAdjustment = Math.min(
    18,
    appliedRules.reduce((total, rule) => total + rule.riskAdjustment, 0),
  );

  return {
    scores: {
      ...rawScores,
      risk: clamp(rawScores.risk + totalRiskAdjustment),
      confidence: clamp(rawScores.confidence - totalConfidencePenalty),
      composite: clamp(rawScores.composite - totalScorePenalty),
    },
    appliedRules,
    totalScorePenalty,
    totalConfidencePenalty,
    totalRiskAdjustment,
  };
}

export function buildCalibrationTableFromBacktest({
  trades,
  targetHitRate,
  stopHitRate,
  averageReturnPct,
}: BacktestCalibrationInput) {
  const usableTrades = trades.filter((trade) => trade.outcome !== "no_data");
  const highScoreTrades = usableTrades.filter((trade) => trade.score >= 70);
  const highScoreStops = highScoreTrades.filter((trade) => trade.outcome === "stop_hit").length;
  const highScoreStopRate = highScoreTrades.length
    ? (highScoreStops / highScoreTrades.length) * 100
    : 0;
  const highRiskTrades = usableTrades.filter((trade) => trade.riskScore >= 55);
  const highRiskAverageReturn = round(
    highRiskTrades.reduce((total, trade) => total + trade.returnPct, 0) /
      Math.max(highRiskTrades.length, 1),
    2,
  );
  const maxDrawdownAverage = round(
    usableTrades.reduce((total, trade) => total + trade.maxDrawdownPct, 0) /
      Math.max(usableTrades.length, 1),
    2,
  );
  const confidence =
    usableTrades.length >= 60 ? "high" : usableTrades.length >= 25 ? "medium" : "low";
  const generatedAt = new Date().toISOString();
  const rules: RankingCalibrationRule[] = [];

  if (highScoreStopRate >= 22 || stopHitRate >= 30) {
    rules.push({
      id: `backtest-high-score-stop-guard-${Date.now()}`,
      ruleKey: "high_score_stop_out_guard",
      label: "High score stop-out guard",
      description:
        "Recent backtests showed too many high-score picks stopping out, so high raw scores now need cleaner risk conditions before reaching the UI.",
      triggerDescription:
        "Raw score >= 70 and risk >= 52, ATR >= 5.5%, or at least one news risk flag.",
      scorePenalty: highScoreStopRate >= 35 ? 6 : 4,
      confidencePenalty: highScoreStopRate >= 35 ? 7 : 5,
      riskAdjustment: highScoreStopRate >= 35 ? 7 : 5,
      sampleSize: highScoreTrades.length,
      targetHitRate,
      stopHitRate: round(highScoreStopRate, 1),
      averageReturnPct,
      confidence,
      active: true,
      source: "backtest",
      createdAt: generatedAt,
    });
  }

  if (stopHitRate >= 25 || maxDrawdownAverage <= -7) {
    rules.push({
      id: `backtest-tight-stop-volatility-${Date.now()}`,
      ruleKey: "tight_stop_volatility",
      label: "Volatility near support",
      description:
        "The latest verification run showed elevated stop pressure, so volatile setups near support receive a larger risk haircut.",
      triggerDescription: "ATR >= 5.5% and price is within 5.5% of modeled support.",
      scorePenalty: stopHitRate >= 35 ? 6 : 4,
      confidencePenalty: 5,
      riskAdjustment: stopHitRate >= 35 ? 8 : 6,
      sampleSize: usableTrades.length,
      targetHitRate,
      stopHitRate,
      averageReturnPct,
      confidence,
      active: true,
      source: "backtest",
      createdAt: generatedAt,
    });
  }

  if (targetHitRate < 45 || averageReturnPct <= 0) {
    rules.push({
      id: `backtest-target-conservatism-${Date.now()}`,
      ruleKey: "low_target_hit_conservatism",
      label: "Target conservatism",
      description:
        "Recent picks did not hit targets often enough, so stretched target setups lose points until forward results improve.",
      triggerDescription: "Raw score >= 68 with modeled resistance more than 12% above current price.",
      scorePenalty: targetHitRate < 35 ? 5 : 3,
      confidencePenalty: 4,
      riskAdjustment: 3,
      sampleSize: usableTrades.length,
      targetHitRate,
      stopHitRate,
      averageReturnPct,
      confidence,
      active: true,
      source: "backtest",
      createdAt: generatedAt,
    });
  }

  if (highRiskTrades.length >= 5 && highRiskAverageReturn <= 0) {
    rules.push({
      id: `backtest-weak-quality-drag-${Date.now()}`,
      ruleKey: "weak_quality_drag",
      label: "Technical-only quality drag",
      description:
        "High-risk setups with weak quality did not earn enough return, so purely technical strength is discounted when fundamentals lag.",
      triggerDescription: "Technical score >= 68 and financial score below 48.",
      scorePenalty: 3,
      confidencePenalty: 3,
      riskAdjustment: 4,
      sampleSize: highRiskTrades.length,
      targetHitRate,
      stopHitRate,
      averageReturnPct: highRiskAverageReturn,
      confidence,
      active: true,
      source: "backtest",
      createdAt: generatedAt,
    });
  }

  return rules.length > 0 ? rules : defaultCalibrationRules;
}

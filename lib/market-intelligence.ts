import type { PredictionOutcomeRow } from "@/lib/database.types";

export type SectorName =
  | "Communication Services"
  | "Consumer Discretionary"
  | "Consumer Staples"
  | "Energy"
  | "Financials"
  | "Health Care"
  | "Industrials"
  | "Information Technology"
  | "Materials"
  | "Real Estate"
  | "Utilities";

export type SetupPattern =
  | "Breakout"
  | "Pullback"
  | "Trend continuation"
  | "Catalyst"
  | "Relative strength"
  | "Defensive strength"
  | "High-volatility reversal";

export type MarketRegimeLabel = "risk-on" | "balanced" | "defensive";

export type SectorRotationItem = {
  averageConfidence: number;
  averageRisk: number;
  averageScore: number;
  benchmarkNote: string;
  count: number;
  label: SectorName;
  leadershipScore: number;
  topSymbol: string;
};

export type MarketRegimeSummary = {
  description: string;
  label: MarketRegimeLabel;
  pace: string;
  score: number;
};

export type OutcomeHeatmapCell = {
  averageReturnPct: number;
  count: number;
  label: string;
  stopHitRate: number;
  targetHitRate: number;
};

export type OutcomeHeatmap = {
  byHoldingWindow: OutcomeHeatmapCell[];
  byRiskBand: OutcomeHeatmapCell[];
  byScoreBand: OutcomeHeatmapCell[];
  bySetupPattern: OutcomeHeatmapCell[];
};

type InsightOpportunity = {
  confidenceScore: number;
  opportunityScore: number;
  potentialGain: string;
  potentialLoss: string;
  riskScore: number;
  symbol: string;
};

const sectorBySymbol: Record<string, SectorName> = {
  AAPL: "Information Technology",
  ADBE: "Information Technology",
  AMD: "Information Technology",
  AMZN: "Consumer Discretionary",
  AVGO: "Information Technology",
  BA: "Industrials",
  CAT: "Industrials",
  COP: "Energy",
  COST: "Consumer Staples",
  CRM: "Information Technology",
  CRWD: "Information Technology",
  CVX: "Energy",
  FCX: "Materials",
  GE: "Industrials",
  GOOGL: "Communication Services",
  HD: "Consumer Discretionary",
  ISRG: "Health Care",
  JPM: "Financials",
  KLAC: "Information Technology",
  LIN: "Materials",
  LLY: "Health Care",
  MA: "Financials",
  MCD: "Consumer Discretionary",
  META: "Communication Services",
  MSFT: "Information Technology",
  NEE: "Utilities",
  NFLX: "Communication Services",
  NOW: "Information Technology",
  NVDA: "Information Technology",
  ORCL: "Information Technology",
  PANW: "Information Technology",
  PGR: "Financials",
  PLD: "Real Estate",
  SBUX: "Consumer Discretionary",
  TMO: "Health Care",
  TSLA: "Consumer Discretionary",
  UBER: "Industrials",
  UNH: "Health Care",
  UNP: "Industrials",
  V: "Financials",
  WMT: "Consumer Staples",
  XOM: "Energy",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percentNumber(value: string) {
  return Number(value.replace("+", "").replace("%", "")) || 0;
}

export function getSectorForSymbol(symbol: string): SectorName {
  return sectorBySymbol[symbol.toUpperCase()] ?? "Information Technology";
}

export function getRewardRiskFromStrings(gain: string, loss: string) {
  const upside = percentNumber(gain);
  const downside = Math.abs(percentNumber(loss));

  return downside > 0 ? upside / downside : upside;
}

export function getSetupPatternForOpportunity(opportunity: InsightOpportunity): SetupPattern {
  const sector = getSectorForSymbol(opportunity.symbol);
  const gain = percentNumber(opportunity.potentialGain);
  const rewardRisk = getRewardRiskFromStrings(opportunity.potentialGain, opportunity.potentialLoss);

  if (opportunity.riskScore >= 68 && gain >= 8) return "High-volatility reversal";
  if (opportunity.confidenceScore >= 78 && opportunity.opportunityScore >= 78) return "Trend continuation";
  if (gain >= 9 && rewardRisk >= 2) return "Breakout";
  if (opportunity.opportunityScore >= 74 && opportunity.confidenceScore < 72) return "Catalyst";
  if (["Consumer Staples", "Health Care", "Utilities"].includes(sector) && opportunity.riskScore <= 52) {
    return "Defensive strength";
  }
  if (opportunity.riskScore <= 48 && rewardRisk >= 1.6) return "Pullback";

  return "Relative strength";
}

export function getScoreMovement(opportunity: InsightOpportunity) {
  const rewardRisk = getRewardRiskFromStrings(opportunity.potentialGain, opportunity.potentialLoss);
  const pressure =
    opportunity.opportunityScore * 0.08 +
    opportunity.confidenceScore * 0.05 +
    rewardRisk * 1.8 -
    opportunity.riskScore * 0.06;
  const estimatedChange = round(clamp(pressure, -8, 8), 1);

  if (estimatedChange >= 2) {
    return {
      label: `Estimated +${estimatedChange}`,
      reason: "Improved because score, confidence, and reward/risk are aligned.",
      tone: "positive" as const,
    };
  }

  if (estimatedChange <= -2) {
    return {
      label: `Estimated ${estimatedChange}`,
      reason: "Weaker because risk is taking more weight than the upside profile.",
      tone: "caution" as const,
    };
  }

  return {
    label: "Mostly stable",
    reason: "No major score-pressure signal is visible from the saved metrics.",
    tone: "neutral" as const,
  };
}

export function getDataFreshnessProfile(createdAt: string, riskScore: number) {
  const created = new Date(createdAt);
  const ageHours = Number.isFinite(created.getTime())
    ? Math.max(0, (Date.now() - created.getTime()) / (60 * 60 * 1000))
    : 999;
  const fresh = ageHours <= 18;
  const stale = ageHours > 36;

  return {
    calibration: "Checked before display",
    earningsRisk: riskScore >= 62 ? "Review event calendar" : "No major event flag in saved score",
    filingFreshness: fresh ? "Recent run" : stale ? "Stale, recheck filings" : "Acceptable",
    macroFreshness: fresh ? "Latest saved run" : "Needs next morning refresh",
    newsFreshness: fresh ? "Recent run" : stale ? "Stale, recheck headlines" : "Acceptable",
    priceFreshness: fresh ? "Recent run" : stale ? "Stale, recheck price" : "Acceptable",
    status: fresh ? "fresh" as const : stale ? "stale" as const : "aging" as const,
  };
}

export function getBeginnerLesson(opportunity: InsightOpportunity) {
  const rewardRisk = getRewardRiskFromStrings(opportunity.potentialGain, opportunity.potentialLoss);

  if (opportunity.riskScore >= 62) {
    return {
      title: "Why position size matters",
      body: "A higher-risk setup can still be useful, but only if the loss at the stop is small enough for your account.",
    };
  }

  if (rewardRisk < 1.8) {
    return {
      title: "Why entry price matters",
      body: "When reward/risk is tight, buying above the planned entry can turn a decent setup into a poor one.",
    };
  }

  if (opportunity.confidenceScore < 70) {
    return {
      title: "Why confirmation matters",
      body: "Lower confidence means the signals do not agree enough yet. Waiting can be part of the trade plan.",
    };
  }

  return {
    title: "Why stop loss matters",
    body: "The stop is the point where the setup may be wrong. It keeps one idea from becoming a portfolio problem.",
  };
}

export function buildSectorRotation(opportunities: InsightOpportunity[]): SectorRotationItem[] {
  const groups = new Map<SectorName, InsightOpportunity[]>();

  opportunities.forEach((opportunity) => {
    const sector = getSectorForSymbol(opportunity.symbol);
    groups.set(sector, [...(groups.get(sector) ?? []), opportunity]);
  });

  return [...groups.entries()]
    .map(([sector, items]) => {
      const averageScore = round(
        items.reduce((total, item) => total + item.opportunityScore, 0) / items.length,
      );
      const averageConfidence = round(
        items.reduce((total, item) => total + item.confidenceScore, 0) / items.length,
      );
      const averageRisk = round(items.reduce((total, item) => total + item.riskScore, 0) / items.length);
      const leadershipScore = Math.round(
        clamp(averageScore * 0.52 + averageConfidence * 0.26 - averageRisk * 0.18 + items.length * 3),
      );
      const topSymbol = [...items].sort((a, b) => b.opportunityScore - a.opportunityScore)[0]?.symbol ?? "--";

      return {
        averageConfidence,
        averageRisk,
        averageScore,
        benchmarkNote:
          leadershipScore >= 72
            ? "Leading in today's ranked list versus broad-market context."
            : leadershipScore >= 60
              ? "Mixed but investable; compare against SPY/QQQ before chasing."
              : "Lagging or defensive; keep selectivity high.",
        count: items.length,
        label: sector,
        leadershipScore,
        topSymbol,
      } satisfies SectorRotationItem;
    })
    .sort((a, b) => b.leadershipScore - a.leadershipScore);
}

export function getMarketRegimeSummary(opportunities: InsightOpportunity[]): MarketRegimeSummary {
  if (opportunities.length === 0) {
    return {
      description: "No saved rankings are available yet, so SwingFi cannot classify today's tape.",
      label: "balanced",
      pace: "Wait for the morning run before making decisions.",
      score: 50,
    };
  }

  const averageScore = opportunities.reduce((total, item) => total + item.opportunityScore, 0) / opportunities.length;
  const averageConfidence = opportunities.reduce((total, item) => total + item.confidenceScore, 0) / opportunities.length;
  const averageRisk = opportunities.reduce((total, item) => total + item.riskScore, 0) / opportunities.length;
  const averageGain = opportunities.reduce((total, item) => total + percentNumber(item.potentialGain), 0) / opportunities.length;
  const score = Math.round(clamp(averageScore * 0.36 + averageConfidence * 0.28 + averageGain * 2 - averageRisk * 0.22));

  if (score >= 68 && averageRisk <= 58) {
    return {
      description: "More setups have score, confidence, and upside aligned. Still require entry discipline.",
      label: "risk-on",
      pace: "Review the top list earlier, but do not chase beyond the planned entry range.",
      score,
    };
  }

  if (score <= 54 || averageRisk >= 66) {
    return {
      description: "The list is more fragile today, with risk taking more weight than clean confirmation.",
      label: "defensive",
      pace: "Move slower, prefer smaller size, and skip setups that are not near entry.",
      score,
    };
  }

  return {
    description: "There are useful opportunities, but the market is not giving broad permission.",
    label: "balanced",
    pace: "Review selectively and let entry range, stop loss, and confidence do the filtering.",
    score,
  };
}

function heatmapCell(label: string, predictions: PredictionOutcomeRow[]): OutcomeHeatmapCell {
  const targetHits = predictions.filter((prediction) => prediction.status === "target_hit").length;
  const stopHits = predictions.filter((prediction) => prediction.status === "stop_hit").length;

  return {
    averageReturnPct: round(
      predictions.length
        ? predictions.reduce((total, prediction) => total + prediction.return_pct, 0) / predictions.length
        : 0,
      2,
    ),
    count: predictions.length,
    label,
    stopHitRate: predictions.length ? round((stopHits / predictions.length) * 100, 1) : 0,
    targetHitRate: predictions.length ? round((targetHits / predictions.length) * 100, 1) : 0,
  };
}

function predictionSetupPattern(prediction: PredictionOutcomeRow): SetupPattern {
  return getSetupPatternForOpportunity({
    confidenceScore: prediction.confidence,
    opportunityScore: prediction.score,
    potentialGain: `${prediction.expected_gain}%`,
    potentialLoss: `-${prediction.expected_loss}%`,
    riskScore: prediction.risk_score,
    symbol: prediction.symbol,
  });
}

export function buildOutcomeHeatmap(predictions: PredictionOutcomeRow[]): OutcomeHeatmap {
  const usable = predictions.filter((prediction) =>
    ["target_hit", "stop_hit", "expired", "no_entry"].includes(prediction.status),
  );
  const scoreBands = [
    ["80+", (item: PredictionOutcomeRow) => item.score >= 80],
    ["70-79", (item: PredictionOutcomeRow) => item.score >= 70 && item.score < 80],
    ["60-69", (item: PredictionOutcomeRow) => item.score >= 60 && item.score < 70],
    ["Below 60", (item: PredictionOutcomeRow) => item.score < 60],
  ] as const;
  const riskBands = [
    ["Low risk", (item: PredictionOutcomeRow) => item.risk_score <= 40],
    ["Moderate risk", (item: PredictionOutcomeRow) => item.risk_score > 40 && item.risk_score <= 60],
    ["High risk", (item: PredictionOutcomeRow) => item.risk_score > 60],
  ] as const;
  const holdingBands = [
    ["1-10 days", (item: PredictionOutcomeRow) => item.holding_period_days <= 10],
    ["11-20 days", (item: PredictionOutcomeRow) => item.holding_period_days > 10 && item.holding_period_days <= 20],
    ["21+ days", (item: PredictionOutcomeRow) => item.holding_period_days > 20],
  ] as const;
  const patterns: SetupPattern[] = [
    "Breakout",
    "Pullback",
    "Trend continuation",
    "Catalyst",
    "Relative strength",
    "Defensive strength",
    "High-volatility reversal",
  ];

  return {
    byHoldingWindow: holdingBands.map(([label, predicate]) => heatmapCell(label, usable.filter(predicate))),
    byRiskBand: riskBands.map(([label, predicate]) => heatmapCell(label, usable.filter(predicate))),
    byScoreBand: scoreBands.map(([label, predicate]) => heatmapCell(label, usable.filter(predicate))),
    bySetupPattern: patterns.map((pattern) =>
      heatmapCell(
        pattern,
        usable.filter((prediction) => predictionSetupPattern(prediction) === pattern),
      ),
    ),
  };
}

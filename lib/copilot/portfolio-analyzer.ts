import type { PortfolioPosition, PortfolioSnapshot, TimeProvider } from "./types";
import { systemTimeProvider } from "./time";

export type PortfolioFindingType =
  | "DATA_STALE"
  | "QUOTE_UNAVAILABLE"
  | "NO_ACTIVE_SWINGFI_PLAN"
  | "NEAR_STOP"
  | "BELOW_OR_AT_STOP"
  | "NEAR_TARGET"
  | "AT_OR_ABOVE_TARGET"
  | "PROFIT_REVIEW_ZONE"
  | "HOLDING_WINDOW_EXPIRING"
  | "HOLDING_WINDOW_EXPIRED"
  | "POSITION_CONCENTRATION"
  | "SECTOR_CONCENTRATION"
  | "EARNINGS_OR_EVENT_RISK"
  | "FILING_OR_HEADLINE_RISK"
  | "TREND_WEAKENING"
  | "MOMENTUM_IMPROVING"
  | "REMAINING_REWARD_RISK_WEAK"
  | "INSIDE_ORIGINAL_PLAN";

export type PortfolioFindingSeverity = "info" | "attention" | "high";

export type PortfolioFindingEvidence = {
  asOf: string | null;
  metric: string;
  source: string;
  value: string | number | boolean | null;
};

export type PortfolioAnalyzerFinding = {
  accountId?: string;
  dataCompleteness: string;
  evidence: PortfolioFindingEvidence[];
  id: string;
  message: string;
  positionId?: string;
  ruleVersion: string;
  severity: PortfolioFindingSeverity;
  symbol?: string;
  title: string;
  type: PortfolioFindingType;
};

export type PortfolioAnalyzerTechnicalEvidence = {
  relativeStrengthTrend?: "improving" | "flat" | "weakening" | "unknown";
  sma20Relationship?: "above" | "below" | "near" | "unknown";
  trendQuality?: "improving" | "stable" | "weakening" | "unknown";
  volumeTrend?: "rising" | "normal" | "falling" | "unknown";
};

export type PortfolioAnalyzerRiskEvidence = {
  asOf?: string | null;
  description?: string;
  eventDate?: string | null;
  hasRisk: boolean;
  source: "earnings_calendar" | "event_calendar" | "news" | "filing" | "other";
};

export type PortfolioAnalyzerPositionEvidence = {
  eventRisk?: PortfolioAnalyzerRiskEvidence[];
  positionId?: string;
  sector?: string | null;
  sourceTradeHistoryId?: string;
  symbol: string;
  technical?: PortfolioAnalyzerTechnicalEvidence;
};

export type PortfolioAnalyzerThresholds = {
  eventRiskLookaheadDays: number;
  holdingWindowExpiringDays: number;
  nearStopPct: number;
  nearTargetPct: number;
  positionConcentrationPct: number;
  profitReviewGainPct: number;
  quoteStaleAfterMinutes: number;
  remainingRewardRiskWeakBelow: number;
  sectorConcentrationPct: number;
};

export type PortfolioAnalyzerInput = {
  clock?: TimeProvider;
  knownPortfolioValue?: number | null;
  marketRegime?: "risk_on" | "balanced" | "defensive" | "unknown";
  positionEvidence?: PortfolioAnalyzerPositionEvidence[];
  snapshot: PortfolioSnapshot;
  thresholds?: Partial<PortfolioAnalyzerThresholds>;
};

const ruleVersion = "portfolio-analyzer.v1";

const defaultThresholds: PortfolioAnalyzerThresholds = {
  eventRiskLookaheadDays: 7,
  holdingWindowExpiringDays: 2,
  nearStopPct: 3,
  nearTargetPct: 3,
  positionConcentrationPct: 35,
  profitReviewGainPct: 5,
  quoteStaleAfterMinutes: 20,
  remainingRewardRiskWeakBelow: 1.2,
  sectorConcentrationPct: 45,
};

const findingPriority: Record<PortfolioFindingType, number> = {
  BELOW_OR_AT_STOP: 10,
  DATA_STALE: 20,
  QUOTE_UNAVAILABLE: 30,
  EARNINGS_OR_EVENT_RISK: 40,
  FILING_OR_HEADLINE_RISK: 50,
  HOLDING_WINDOW_EXPIRED: 60,
  NEAR_STOP: 70,
  REMAINING_REWARD_RISK_WEAK: 80,
  TREND_WEAKENING: 90,
  AT_OR_ABOVE_TARGET: 100,
  NEAR_TARGET: 110,
  PROFIT_REVIEW_ZONE: 120,
  HOLDING_WINDOW_EXPIRING: 130,
  POSITION_CONCENTRATION: 140,
  SECTOR_CONCENTRATION: 150,
  NO_ACTIVE_SWINGFI_PLAN: 160,
  MOMENTUM_IMPROVING: 170,
  INSIDE_ORIGINAL_PLAN: 180,
};

const severityPriority: Record<PortfolioFindingSeverity, number> = {
  high: 0,
  attention: 1,
  info: 2,
};

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dateOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: string | undefined, end: Date) {
  const parsed = dateOrNull(start);
  if (!parsed) return null;
  return Math.max(0, Math.floor((end.getTime() - parsed.getTime()) / 86_400_000));
}

function minutesBetween(start: string | null | undefined, end: Date) {
  const parsed = dateOrNull(start);
  if (!parsed) return null;
  return Math.max(0, (end.getTime() - parsed.getTime()) / 60_000);
}

function isWithinLookahead(
  item: PortfolioAnalyzerRiskEvidence,
  now: Date,
  lookaheadDays: number,
) {
  const eventDate = dateOrNull(item.eventDate ?? item.asOf);

  if (!eventDate) return true;

  const daysUntil = Math.floor((eventDate.getTime() - now.getTime()) / 86_400_000);

  return daysUntil >= 0 && daysUntil <= lookaheadDays;
}

function pct(value: number) {
  return Number(value.toFixed(2));
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function formatPercent(value: number) {
  return `${pct(value)}%`;
}

function formatPrice(value: number) {
  return `$${Number(value.toFixed(value >= 1000 ? 0 : 2)).toLocaleString("en-US")}`;
}

function validateThresholds(
  thresholds: Partial<PortfolioAnalyzerThresholds> | undefined,
): PortfolioAnalyzerThresholds {
  const merged = { ...defaultThresholds, ...thresholds };

  Object.entries(merged).forEach(([key, value]) => {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid PortfolioAnalyzer threshold: ${key}.`);
    }
  });

  return merged;
}

function evidence(
  metric: string,
  value: string | number | boolean | null,
  source: string,
  asOf: string | null | undefined,
): PortfolioFindingEvidence {
  return {
    asOf: asOf ?? null,
    metric,
    source,
    value,
  };
}

function completenessFor(position: PortfolioPosition) {
  const missing: string[] = [];

  if (numberOrNull(position.currentPrice) === null) missing.push("current price");
  if (!position.quote || position.quote.status !== "fresh") missing.push("fresh quote");
  if (!position.originalPlan) missing.push("original plan");
  if (position.originalPlan?.targetPrice === null) missing.push("target");
  if (position.originalPlan?.stopLoss === null) missing.push("stop");
  if (position.originalPlan?.holdingPeriodDays === null) missing.push("holding window");
  if (position.marketValue === null) missing.push("market value");

  return missing.length ? `Partial data: missing ${missing.join(", ")}.` : "Complete for this rule.";
}

function makeFinding(args: Omit<PortfolioAnalyzerFinding, "id" | "ruleVersion">) {
  const ref = args.positionId ?? args.accountId ?? args.symbol ?? "portfolio";

  return {
    ...args,
    id: `${ruleVersion}:${args.type}:${ref}`,
    ruleVersion,
  };
}

function positionEvidenceKey(position: PortfolioPosition) {
  return `${position.id}|${position.sourceTradeHistoryId ?? ""}|${normalizeSymbol(position.symbol)}`;
}

function evidenceMatches(position: PortfolioPosition, item: PortfolioAnalyzerPositionEvidence) {
  const symbolMatches = normalizeSymbol(item.symbol) === normalizeSymbol(position.symbol);
  const positionMatches = item.positionId ? item.positionId === position.id : false;
  const tradeMatches = item.sourceTradeHistoryId
    ? item.sourceTradeHistoryId === position.sourceTradeHistoryId
    : false;

  return positionMatches || tradeMatches || symbolMatches;
}

function isFreshPositionQuote(
  position: PortfolioPosition,
  thresholds: PortfolioAnalyzerThresholds,
  now: Date,
) {
  if (!position.quote || position.quote.status !== "fresh") return false;
  const ageMinutes = minutesBetween(position.quote.dataAsOf, now);

  return ageMinutes !== null && ageMinutes <= thresholds.quoteStaleAfterMinutes;
}

function hasValidPlan(position: PortfolioPosition) {
  return (
    numberOrNull(position.originalPlan?.entryPrice) !== null &&
    numberOrNull(position.originalPlan?.targetPrice) !== null &&
    numberOrNull(position.originalPlan?.stopLoss) !== null
  );
}

function pricePlanState(position: PortfolioPosition, thresholds: PortfolioAnalyzerThresholds) {
  const current = numberOrNull(position.currentPrice);
  const target = numberOrNull(position.originalPlan?.targetPrice);
  const stop = numberOrNull(position.originalPlan?.stopLoss);
  const entry = numberOrNull(position.originalPlan?.entryPrice ?? position.averageEntryPrice);

  if (current === null || target === null || stop === null) return null;

  const targetDistancePct = ((target - current) / current) * 100;
  const stopBufferPct = ((current - stop) / current) * 100;
  const openReturnPct = entry ? ((current - entry) / entry) * 100 : null;
  const reward = target - current;
  const risk = current - stop;
  const remainingRewardRisk = reward > 0 && risk > 0 ? reward / risk : null;

  return {
    current,
    entry,
    openReturnPct,
    remainingRewardRisk,
    stop,
    stopBufferPct,
    target,
    targetDistancePct,
    weakRewardRisk:
      remainingRewardRisk !== null &&
      remainingRewardRisk < thresholds.remainingRewardRiskWeakBelow,
  };
}

function analyzePosition(args: {
  evidence?: PortfolioAnalyzerPositionEvidence;
  now: Date;
  position: PortfolioPosition;
  thresholds: PortfolioAnalyzerThresholds;
}) {
  const { position, thresholds, now } = args;
  const findings: PortfolioAnalyzerFinding[] = [];
  const symbol = normalizeSymbol(position.symbol);
  const completeness = completenessFor(position);
  const quoteAge = minutesBetween(position.quote?.dataAsOf ?? position.dataAsOf, now);
  const quoteFresh = isFreshPositionQuote(position, thresholds, now);
  const quoteAsOf = position.quote?.dataAsOf ?? position.dataAsOf;

  if (
    position.quote?.status === "stale" ||
    (position.quote?.status === "fresh" &&
      (quoteAge === null || quoteAge > thresholds.quoteStaleAfterMinutes))
  ) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: [
        evidence("quote_status", position.quote?.status ?? "unknown", position.quote?.source ?? "position", quoteAsOf),
        evidence("quote_age_minutes", quoteAge === null ? null : pct(quoteAge), "PortfolioAnalyzer", quoteAsOf),
      ],
      message: `${symbol} has stale price data, so SwingFi is not using that quote for target, stop, or reward/risk findings.`,
      positionId: position.id,
      severity: "attention",
      symbol,
      title: "Price data is stale",
      type: "DATA_STALE",
    }));
  }

  if (
    numberOrNull(position.currentPrice) === null ||
    position.quote?.status === "missing" ||
    position.quote?.status === "error"
  ) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: [
        evidence("quote_status", position.quote?.status ?? "missing", position.quote?.source ?? "position", quoteAsOf),
      ],
      message: `${symbol} does not have a reliable current quote. Review the original target, stop, and holding window until fresh price data is available.`,
      positionId: position.id,
      severity: "attention",
      symbol,
      title: "Current quote unavailable",
      type: "QUOTE_UNAVAILABLE",
    }));
  }

  if (!hasValidPlan(position)) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: [
        evidence("entry_price", position.originalPlan?.entryPrice ?? position.averageEntryPrice, "original_plan", position.originalPlan?.planCreatedAt),
        evidence("target_price", position.originalPlan?.targetPrice ?? null, "original_plan", position.originalPlan?.planCreatedAt),
        evidence("stop_loss", position.originalPlan?.stopLoss ?? null, "original_plan", position.originalPlan?.planCreatedAt),
      ],
      message: `${symbol} is missing a complete SwingFi plan, so Copilot can review data quality but cannot compare price against a saved target and stop.`,
      positionId: position.id,
      severity: "attention",
      symbol,
      title: "Original SwingFi plan is incomplete",
      type: "NO_ACTIVE_SWINGFI_PLAN",
    }));
  }

  if (quoteFresh && hasValidPlan(position)) {
    const state = pricePlanState(position, thresholds);

    if (state) {
      if (state.current <= state.stop) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("current_price", state.current, position.quote?.source ?? "quote", quoteAsOf),
            evidence("original_stop", state.stop, "original_plan", position.originalPlan?.planCreatedAt),
          ],
          message: `${symbol} is at or below the original stop. Review whether the trade is outside the risk line saved in the plan.`,
          positionId: position.id,
          severity: "high",
          symbol,
          title: "At or below original stop",
          type: "BELOW_OR_AT_STOP",
        }));
      } else if (state.stopBufferPct <= thresholds.nearStopPct) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("stop_buffer_pct", formatPercent(state.stopBufferPct), "PortfolioAnalyzer", quoteAsOf),
            evidence("original_stop", state.stop, "original_plan", position.originalPlan?.planCreatedAt),
          ],
          message: `${symbol} is ${formatPercent(state.stopBufferPct)} above the original stop. Review the plan before the position gets closer to the saved risk line.`,
          positionId: position.id,
          severity: "high",
          symbol,
          title: "Approaching original stop",
          type: "NEAR_STOP",
        }));
      }

      if (state.current >= state.target) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("current_price", state.current, position.quote?.source ?? "quote", quoteAsOf),
            evidence("original_target", state.target, "original_plan", position.originalPlan?.planCreatedAt),
          ],
          message: `${symbol} is at or above the original target. Review whether the planned reward area has been reached and whether the position still needs a new written plan.`,
          positionId: position.id,
          severity: "attention",
          symbol,
          title: "At or above original target",
          type: "AT_OR_ABOVE_TARGET",
        }));
      } else if (state.targetDistancePct <= thresholds.nearTargetPct) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("target_distance_pct", formatPercent(state.targetDistancePct), "PortfolioAnalyzer", quoteAsOf),
            evidence("original_target", state.target, "original_plan", position.originalPlan?.planCreatedAt),
          ],
          message: `${symbol} is within ${formatPercent(state.targetDistancePct)} of the original target. Review the profit plan before price reaches that area.`,
          positionId: position.id,
          severity: "attention",
          symbol,
          title: "Approaching original target",
          type: "NEAR_TARGET",
        }));
      }

      if (
        state.openReturnPct !== null &&
        state.openReturnPct >= thresholds.profitReviewGainPct &&
        state.current < state.target
      ) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("open_return_pct", formatPercent(state.openReturnPct), "PortfolioAnalyzer", quoteAsOf),
            evidence("profit_review_threshold_pct", thresholds.profitReviewGainPct, "PortfolioAnalyzer", quoteAsOf),
          ],
          message: `${symbol} is up ${formatPercent(state.openReturnPct)} from the original entry while still below target. Review whether the reward left is worth the remaining risk.`,
          positionId: position.id,
          severity: "info",
          symbol,
          title: "Profit review zone",
          type: "PROFIT_REVIEW_ZONE",
        }));
      }

      if (state.weakRewardRisk) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("remaining_reward_risk", state.remainingRewardRisk === null ? null : Number(state.remainingRewardRisk.toFixed(2)), "PortfolioAnalyzer", quoteAsOf),
            evidence("weak_below", thresholds.remainingRewardRiskWeakBelow, "PortfolioAnalyzer", quoteAsOf),
          ],
          message: `${symbol} has weak remaining reward/risk from the current price to the original target and stop. Review whether the setup still offers enough upside for the risk left.`,
          positionId: position.id,
          severity: "attention",
          symbol,
          title: "Remaining reward/risk is weak",
          type: "REMAINING_REWARD_RISK_WEAK",
        }));
      }

      if (
        state.current > state.stop &&
        state.current < state.target &&
        state.stopBufferPct > thresholds.nearStopPct &&
        state.targetDistancePct > thresholds.nearTargetPct &&
        !state.weakRewardRisk
      ) {
        findings.push(makeFinding({
          dataCompleteness: completeness,
          evidence: [
            evidence("current_price", state.current, position.quote?.source ?? "quote", quoteAsOf),
            evidence("original_target", formatPrice(state.target), "original_plan", position.originalPlan?.planCreatedAt),
            evidence("original_stop", formatPrice(state.stop), "original_plan", position.originalPlan?.planCreatedAt),
          ],
          message: `${symbol} is still between the original stop and target with enough room on both sides. Review normally and keep comparing price to the saved plan.`,
          positionId: position.id,
          severity: "info",
          symbol,
          title: "Inside original plan",
          type: "INSIDE_ORIGINAL_PLAN",
        }));
      }
    }
  }

  const holdingDays = daysBetween(position.openedAt, now);
  const holdingWindow = numberOrNull(position.originalPlan?.holdingPeriodDays);

  if (holdingDays !== null && holdingWindow !== null) {
    const daysLeft = holdingWindow - holdingDays;
    if (daysLeft < 0) {
      findings.push(makeFinding({
        dataCompleteness: completeness,
        evidence: [
          evidence("days_held", holdingDays, "PortfolioAnalyzer", position.openedAt ?? null),
          evidence("planned_holding_days", holdingWindow, "original_plan", position.originalPlan?.planCreatedAt),
        ],
        message: `${symbol} is past the original swing window. Review whether the reason for staying in the position still matches the saved plan.`,
        positionId: position.id,
        severity: "attention",
        symbol,
        title: "Holding window expired",
        type: "HOLDING_WINDOW_EXPIRED",
      }));
    } else if (daysLeft <= thresholds.holdingWindowExpiringDays) {
      findings.push(makeFinding({
        dataCompleteness: completeness,
        evidence: [
          evidence("days_left", daysLeft, "PortfolioAnalyzer", position.openedAt ?? null),
          evidence("planned_holding_days", holdingWindow, "original_plan", position.originalPlan?.planCreatedAt),
        ],
        message: `${symbol} has ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in the original swing window. Review the plan soon instead of letting the trade drift.`,
        positionId: position.id,
        severity: "attention",
        symbol,
        title: "Holding window nearly finished",
        type: "HOLDING_WINDOW_EXPIRING",
      }));
    }
  }

  const eventRisks = args.evidence?.eventRisk?.filter((item) => item.hasRisk) ?? [];
  const earningsRisks = eventRisks.filter((item) =>
    (item.source === "earnings_calendar" || item.source === "event_calendar") &&
    isWithinLookahead(item, now, thresholds.eventRiskLookaheadDays),
  );
  const filingOrHeadlineRisks = eventRisks.filter((item) =>
    item.source === "filing" || item.source === "news",
  );

  if (earningsRisks.length) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: earningsRisks.map((item) =>
        evidence("event_risk", item.description ?? item.source, item.source, item.eventDate ?? item.asOf ?? null),
      ),
      message: `${symbol} has upcoming earnings or event risk in the supplied evidence. Review whether that event fits the original swing window.`,
      positionId: position.id,
      severity: "high",
      symbol,
      title: "Upcoming event risk",
      type: "EARNINGS_OR_EVENT_RISK",
    }));
  }

  if (filingOrHeadlineRisks.length) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: filingOrHeadlineRisks.map((item) =>
        evidence("risk_flag", item.description ?? item.source, item.source, item.asOf ?? null),
      ),
      message: `${symbol} has filing or headline risk in the supplied evidence. Review the new information against the original setup.`,
      positionId: position.id,
      severity: "attention",
      symbol,
      title: "Filing or headline risk",
      type: "FILING_OR_HEADLINE_RISK",
    }));
  }

  const technical = args.evidence?.technical;

  if (
    technical?.trendQuality === "weakening" ||
    technical?.relativeStrengthTrend === "weakening" ||
    technical?.sma20Relationship === "below"
  ) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: [
        evidence("trend_quality", technical.trendQuality ?? "unknown", "technical_evidence", quoteAsOf),
        evidence("relative_strength_trend", technical.relativeStrengthTrend ?? "unknown", "technical_evidence", quoteAsOf),
        evidence("sma20_relationship", technical.sma20Relationship ?? "unknown", "technical_evidence", quoteAsOf),
      ],
      message: `${symbol} has weakening technical evidence supplied to Copilot. Review whether the position still has enough support to match the original plan.`,
      positionId: position.id,
      severity: "attention",
      symbol,
      title: "Trend is weakening",
      type: "TREND_WEAKENING",
    }));
  } else if (
    technical?.trendQuality === "improving" ||
    technical?.relativeStrengthTrend === "improving" ||
    technical?.volumeTrend === "rising"
  ) {
    findings.push(makeFinding({
      dataCompleteness: completeness,
      evidence: [
        evidence("trend_quality", technical.trendQuality ?? "unknown", "technical_evidence", quoteAsOf),
        evidence("relative_strength_trend", technical.relativeStrengthTrend ?? "unknown", "technical_evidence", quoteAsOf),
        evidence("volume_trend", technical.volumeTrend ?? "unknown", "technical_evidence", quoteAsOf),
      ],
      message: `${symbol} has improving momentum evidence supplied to Copilot. Review it alongside the original target, stop, and remaining reward/risk.`,
      positionId: position.id,
      severity: "info",
      symbol,
      title: "Momentum is improving",
      type: "MOMENTUM_IMPROVING",
    }));
  }

  return findings;
}

function portfolioConcentrationFindings(args: {
  evidenceByPosition: Map<string, PortfolioAnalyzerPositionEvidence>;
  knownPortfolioValue: number | null | undefined;
  positions: PortfolioPosition[];
  thresholds: PortfolioAnalyzerThresholds;
}) {
  const knownTotal = numberOrNull(args.knownPortfolioValue);
  if (knownTotal === null) return [];

  const findings: PortfolioAnalyzerFinding[] = [];

  args.positions.forEach((position) => {
    const marketValue = numberOrNull(position.marketValue);
    if (marketValue === null) return;
    const weightPct = (marketValue / knownTotal) * 100;
    if (weightPct < args.thresholds.positionConcentrationPct) return;

    findings.push(makeFinding({
      dataCompleteness: "Complete for this rule.",
      evidence: [
        evidence("position_weight_pct", formatPercent(weightPct), "PortfolioAnalyzer", position.dataAsOf),
        evidence("known_portfolio_value", knownTotal, "PortfolioAnalyzerInput", null),
        evidence("market_value", marketValue, "position", position.dataAsOf),
      ],
      message: `${normalizeSymbol(position.symbol)} is ${formatPercent(weightPct)} of the known portfolio value. Review whether one position is carrying too much of the swing-trade risk.`,
      positionId: position.id,
      severity: weightPct >= args.thresholds.positionConcentrationPct * 1.5 ? "high" : "attention",
      symbol: normalizeSymbol(position.symbol),
      title: "Position concentration",
      type: "POSITION_CONCENTRATION",
    }));
  });

  const sectorValues = new Map<string, { asOf: string | null; value: number }>();
  args.positions.forEach((position) => {
    const marketValue = numberOrNull(position.marketValue);
    const sector = findEvidenceForPosition(position, args.evidenceByPosition)?.sector?.trim();

    if (marketValue === null || !sector) return;

    const current = sectorValues.get(sector) ?? { asOf: position.dataAsOf, value: 0 };
    sectorValues.set(sector, {
      asOf: current.asOf ?? position.dataAsOf,
      value: current.value + marketValue,
    });
  });

  sectorValues.forEach((item, sector) => {
    const weightPct = (item.value / knownTotal) * 100;
    if (weightPct < args.thresholds.sectorConcentrationPct) return;

    findings.push(makeFinding({
      dataCompleteness: "Only positions with known sector and market value were aggregated.",
      evidence: [
        evidence("sector", sector, "position_evidence", item.asOf),
        evidence("sector_weight_pct", formatPercent(weightPct), "PortfolioAnalyzer", item.asOf),
        evidence("known_portfolio_value", knownTotal, "PortfolioAnalyzerInput", null),
      ],
      message: `${sector} is ${formatPercent(weightPct)} of the known portfolio value supplied to Copilot. Review whether the portfolio depends too heavily on one sector.`,
      severity: weightPct >= args.thresholds.sectorConcentrationPct * 1.35 ? "high" : "attention",
      title: "Sector concentration",
      type: "SECTOR_CONCENTRATION",
    }));
  });

  return findings;
}

function dedupeFindings(findings: PortfolioAnalyzerFinding[]) {
  const conflicts: Partial<Record<PortfolioFindingType, PortfolioFindingType[]>> = {
    AT_OR_ABOVE_TARGET: ["NEAR_TARGET", "INSIDE_ORIGINAL_PLAN", "PROFIT_REVIEW_ZONE"],
    BELOW_OR_AT_STOP: ["NEAR_STOP", "INSIDE_ORIGINAL_PLAN", "REMAINING_REWARD_RISK_WEAK"],
    DATA_STALE: [
      "AT_OR_ABOVE_TARGET",
      "BELOW_OR_AT_STOP",
      "INSIDE_ORIGINAL_PLAN",
      "NEAR_STOP",
      "NEAR_TARGET",
      "PROFIT_REVIEW_ZONE",
      "REMAINING_REWARD_RISK_WEAK",
    ],
    HOLDING_WINDOW_EXPIRED: ["HOLDING_WINDOW_EXPIRING"],
    NO_ACTIVE_SWINGFI_PLAN: ["INSIDE_ORIGINAL_PLAN", "REMAINING_REWARD_RISK_WEAK"],
    QUOTE_UNAVAILABLE: [
      "AT_OR_ABOVE_TARGET",
      "BELOW_OR_AT_STOP",
      "INSIDE_ORIGINAL_PLAN",
      "NEAR_STOP",
      "NEAR_TARGET",
      "PROFIT_REVIEW_ZONE",
      "REMAINING_REWARD_RISK_WEAK",
    ],
  };
  const byId = new Map<string, PortfolioAnalyzerFinding>();

  findings.forEach((finding) => {
    const existing = byId.get(finding.id);
    if (!existing) {
      byId.set(finding.id, finding);
      return;
    }

    if (
      severityPriority[finding.severity] < severityPriority[existing.severity] ||
      findingPriority[finding.type] < findingPriority[existing.type]
    ) {
      byId.set(finding.id, finding);
    }
  });

  const unique = Array.from(byId.values());

  return unique
    .filter((finding) => {
      const ref = finding.positionId ?? finding.accountId ?? finding.symbol ?? "portfolio";
      return !unique.some((candidate) => {
        if (candidate === finding) return false;
        const candidateRef = candidate.positionId ?? candidate.accountId ?? candidate.symbol ?? "portfolio";
        return (
          candidateRef === ref &&
          conflicts[candidate.type]?.includes(finding.type)
        );
      });
    })
    .sort((a, b) => {
      const severityDiff = severityPriority[a.severity] - severityPriority[b.severity];
      if (severityDiff) return severityDiff;
      const priorityDiff = findingPriority[a.type] - findingPriority[b.type];
      if (priorityDiff) return priorityDiff;
      return a.id.localeCompare(b.id);
    });
}

function createEvidenceMap(items: PortfolioAnalyzerPositionEvidence[] = []) {
  const map = new Map<string, PortfolioAnalyzerPositionEvidence>();

  items.forEach((item) => {
    const symbol = normalizeSymbol(item.symbol);
    const parts = [item.positionId ?? "", item.sourceTradeHistoryId ?? "", symbol];
    map.set(parts.join("|"), {
      ...item,
      symbol,
    });
  });

  return map;
}

function findEvidenceForPosition(
  position: PortfolioPosition,
  evidenceByPosition: Map<string, PortfolioAnalyzerPositionEvidence>,
) {
  const exact = evidenceByPosition.get(positionEvidenceKey(position));
  if (exact) return exact;

  return Array.from(evidenceByPosition.values()).find((item) =>
    evidenceMatches(position, item),
  );
}

export class PortfolioAnalyzer {
  analyze(input: PortfolioAnalyzerInput): PortfolioAnalyzerFinding[] {
    const thresholds = validateThresholds(input.thresholds);
    const clock = input.clock ?? systemTimeProvider;
    const now = clock.now();
    const evidenceByPosition = createEvidenceMap(input.positionEvidence);
    const positionFindings = input.snapshot.positions.flatMap((position) =>
      analyzePosition({
        evidence: findEvidenceForPosition(position, evidenceByPosition),
        now,
        position,
        thresholds,
      }),
    );
    const concentrationFindings = portfolioConcentrationFindings({
      evidenceByPosition,
      knownPortfolioValue: input.knownPortfolioValue,
      positions: input.snapshot.positions,
      thresholds,
    });

    return dedupeFindings([...positionFindings, ...concentrationFindings]);
  }
}

export function analyzePortfolio(input: PortfolioAnalyzerInput) {
  return new PortfolioAnalyzer().analyze(input);
}

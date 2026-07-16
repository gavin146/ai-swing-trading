import type { OpportunityRow } from "@/lib/database.types";
import { applyScoreCalibration } from "./calibration";
import { estimateDailyAgentCost } from "./costs";
import { getMockEquityUniverse } from "./mock-equity-universe";
import type {
  AgentDataSource,
  AgentRunResult,
  EquityCandidate,
  RankedEquityOpportunity,
  ScoreBreakdown,
} from "./types";

type RunOptions = {
  asOf?: Date;
  limit?: number;
};

type RankOptions = RunOptions & {
  source?: AgentDataSource;
  dataQuality?: AgentRunResult["dataQuality"];
  summaryPrefix?: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toScore(value: number, min: number, max: number) {
  return clamp(((value - min) / (max - min)) * 100);
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mockUuid(namespace: string, key: string) {
  const source = `${namespace}:${key}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 2246822507);
    h4 = Math.imul(h4 ^ code, 3266489909);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex = [h1, h2, h3, h4]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");

  const value = hex.slice(0, 32).split("");
  value[12] = "4";
  value[16] = ((parseInt(value[16], 16) & 0x3) | 0x8).toString(16);

  return `${value.slice(0, 8).join("")}-${value.slice(8, 12).join("")}-${value
    .slice(12, 16)
    .join("")}-${value.slice(16, 20).join("")}-${value.slice(20, 32).join("")}`;
}

function dedupeUniverseBySymbol(universe: EquityCandidate[]) {
  const bySymbol = new Map<string, EquityCandidate>();

  universe.forEach((candidate) => {
    const symbol = candidate.symbol.trim().toUpperCase();
    const current = bySymbol.get(symbol);

    if (!current) {
      bySymbol.set(symbol, { ...candidate, symbol });
      return;
    }

    const currentScore = scoreCandidate(current).composite;
    const nextScore = scoreCandidate(candidate).composite;

    if (nextScore > currentScore) {
      bySymbol.set(symbol, { ...candidate, symbol });
    }
  });

  return Array.from(bySymbol.values());
}

function scoreTechnical(candidate: EquityCandidate) {
  const { technical } = candidate;
  const movingAverageStack =
    (technical.price > technical.sma20 ? 18 : 4) +
    (technical.sma20 > technical.sma50 ? 16 : 5) +
    (technical.sma50 > technical.sma200 ? 16 : 6);
  const rsiScore = technical.rsi14 >= 48 && technical.rsi14 <= 66 ? 16 : 8;
  const relativeStrength = toScore(technical.relativeStrength90d, 35, 95) * 0.18;
  const marketRelative = (technical.relativeStrengthVsMarket ?? 50) * 0.11;
  const sectorRelative = (technical.relativeStrengthVsSector ?? 50) * 0.09;
  const trendQuality = (technical.trendQuality ?? 50) * 0.08;
  const breakoutProximity = (technical.breakoutProximity ?? 50) * 0.04;
  const volume = toScore(technical.volumeTrend, -10, 30) * 0.12;

  return clamp(
    movingAverageStack +
      rsiScore +
      relativeStrength +
      marketRelative +
      sectorRelative +
      trendQuality +
      breakoutProximity +
      volume,
  );
}

function scoreFinancials(candidate: EquityCandidate) {
  const { financials } = candidate;

  return clamp(
    toScore(financials.revenueGrowth, -5, 30) * 0.24 +
      toScore(financials.earningsGrowth, -10, 40) * 0.24 +
      toScore(financials.freeCashFlowYield, 0, 8) * 0.14 +
      (100 - toScore(financials.debtToEquity, 0, 3)) * 0.12 +
      toScore(financials.marginTrend, -6, 12) * 0.12 +
      financials.revisionScore * 0.08 +
      financials.valuationScore * 0.06,
  );
}

function scoreNews(candidate: EquityCandidate) {
  const { news } = candidate;

  return clamp(
    news.sentimentScore * 0.42 +
      news.catalystScore * 0.38 +
      toScore(news.headlineCount, 1, 24) * 0.1 -
      news.riskFlagCount * 6 -
      (news.eventRiskScore ?? 0) * 0.08 -
      (news.filingRiskScore ?? 0) * 0.07,
  );
}

function scoreMacro(candidate: EquityCandidate) {
  const { market } = candidate;

  return clamp(
    market.marketRegimeScore * 0.3 +
      market.sectorTrendScore * 0.28 +
      market.breadthScore * 0.18 +
      market.economicSurpriseScore * 0.14 +
      (100 - market.ratesPressureScore) * 0.1,
  );
}

function scoreLiquidity(candidate: EquityCandidate) {
  const volumeScore = toScore(candidate.averageVolume, 1000000, 70000000);
  const capScore = toScore(candidate.marketCapBillions, 20, 900);
  return clamp(volumeScore * 0.55 + capScore * 0.45);
}

function scoreRisk(candidate: EquityCandidate) {
  const { technical, financials, news } = candidate;
  const volatilityRisk = toScore(technical.atrPercent, 1.5, 8.5) * 0.4;
  const supportDistanceRisk =
    toScore(((technical.price - technical.support) / technical.price) * 100, 2, 10) * 0.24;
  const balanceSheetRisk = toScore(financials.debtToEquity, 0, 3) * 0.14;
  const newsRisk = clamp(news.riskFlagCount * 14) * 0.1;
  const eventRisk = (news.eventRiskScore ?? 0) * 0.12;
  const filingRisk = (news.filingRiskScore ?? 0) * 0.09;
  const rsiRisk = technical.rsi14 > 68 ? 12 : technical.rsi14 < 44 ? 8 : 3;

  return clamp(
    volatilityRisk +
      supportDistanceRisk +
      balanceSheetRisk +
      newsRisk +
      eventRisk +
      filingRisk +
      rsiRisk,
  );
}

function scoreConfidence(scores: Omit<ScoreBreakdown, "confidence" | "composite">) {
  const values = [
    scores.technical,
    scores.financial,
    scores.news,
    scores.macro,
    scores.liquidity,
  ];
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const dispersion =
    values.reduce((total, value) => total + Math.abs(value - average), 0) / values.length;
  const agreement = 100 - dispersion;
  const riskAdjustment = 100 - scores.risk * 0.45;

  return Math.round(clamp(agreement * 0.58 + riskAdjustment * 0.32 + average * 0.1));
}

function supportDistancePct(candidate: EquityCandidate) {
  const price = candidate.technical.price;

  if (price <= 0) return 0;

  return ((price - candidate.technical.support) / price) * 100;
}

function rewardDistancePct(candidate: EquityCandidate) {
  const price = candidate.technical.price;

  if (price <= 0) return 0;

  return ((candidate.technical.resistance - price) / price) * 100;
}

function rewardRiskRatio(candidate: EquityCandidate) {
  const risk = supportDistancePct(candidate);
  const reward = rewardDistancePct(candidate);

  return reward / Math.max(risk, 1);
}

function scoreSwingSetup(candidate: EquityCandidate) {
  const supportDistance = supportDistancePct(candidate);
  const rewardDistance = rewardDistancePct(candidate);
  const rewardRisk = rewardRiskRatio(candidate);
  const marketRelative = candidate.technical.relativeStrengthVsMarket ?? 50;
  const sectorRelative = candidate.technical.relativeStrengthVsSector ?? 50;
  const eventRisk = candidate.news.eventRiskScore ?? 0;
  const filingRisk = candidate.news.filingRiskScore ?? 0;
  const daysToEarnings = candidate.news.daysToEarnings;
  const binaryEventPenalty = daysToEarnings !== null && daysToEarnings !== undefined && daysToEarnings <= 5 ? 12 : 0;
  const entryDiscipline =
    supportDistance <= 3.5
      ? 16
      : supportDistance <= 6
        ? 13
        : supportDistance <= 8.5
          ? 8
          : supportDistance <= 11
            ? 3
            : -4;
  const upsideScore = toScore(rewardDistance, 3.5, 12) * 0.18;
  const rewardRiskScore = toScore(rewardRisk, 1, 3.2) * 0.22;
  const relativeScore = (marketRelative * 0.11) + (sectorRelative * 0.09);
  const volumeScore = toScore(candidate.technical.volumeTrend, -20, 45) * 0.12;
  const trendScore = (candidate.technical.trendQuality ?? 50) * 0.13;
  const volatilityPenalty = toScore(candidate.technical.atrPercent, 6, 13) * 0.1;
  const riskPenalty = (eventRisk * 0.08) + (filingRisk * 0.07) + binaryEventPenalty;

  return clamp(
    18 +
      entryDiscipline +
      upsideScore +
      rewardRiskScore +
      relativeScore +
      volumeScore +
      trendScore -
      volatilityPenalty -
      riskPenalty,
  );
}

function dataCompletenessScore(candidate: EquityCandidate) {
  const { financials, news, technical } = candidate;
  const hasMeaningfulFinancials =
    Math.abs(financials.revenueGrowth) > 0.1 ||
    Math.abs(financials.earningsGrowth) > 0.1 ||
    Math.abs(financials.marginTrend) > 0.1 ||
    financials.revisionScore !== 55 ||
    financials.valuationScore !== 55;
  const hasCatalystDetail =
    news.headlineCount > 0 || Boolean(news.catalystTags?.length) || news.daysToEarnings !== undefined;
  const hasEventDetail =
    news.daysToEarnings !== undefined ||
    news.eventRiskScore !== undefined ||
    news.filingRiskScore !== undefined;
  const hasRelativeBenchmarks =
    technical.relativeStrengthVsMarket !== undefined &&
    technical.relativeStrengthVsSector !== undefined;

  return Math.round(
    clamp(
      22 +
        (hasRelativeBenchmarks ? 18 : 0) +
        (candidate.averageVolume >= 500_000 && candidate.marketCapBillions >= 1 ? 12 : 0) +
        (hasMeaningfulFinancials ? 16 : 0) +
        (hasCatalystDetail ? 17 : 0) +
        (hasEventDetail ? 8 : 0) +
        (news.summary.toLowerCase().includes("sec") || news.filingRiskScore !== undefined ? 7 : 0),
    ),
  );
}

function predictionQualityAdjustment(
  candidate: EquityCandidate,
  partial: Omit<ScoreBreakdown, "confidence" | "composite">,
) {
  const supportDistance = supportDistancePct(candidate);
  const rewardDistance = rewardDistancePct(candidate);
  const rewardRisk = rewardRiskRatio(candidate);
  const hasRelativeBenchmarks =
    candidate.technical.relativeStrengthVsMarket !== undefined &&
    candidate.technical.relativeStrengthVsSector !== undefined;
  const marketRelative = candidate.technical.relativeStrengthVsMarket ?? 50;
  const sectorRelative = candidate.technical.relativeStrengthVsSector ?? 50;
  const eventRisk = candidate.news.eventRiskScore ?? 0;
  const filingRisk = candidate.news.filingRiskScore ?? 0;
  const dataCompleteness = dataCompletenessScore(candidate);
  const underperformingBenchmarks = hasRelativeBenchmarks && (marketRelative < 45 || sectorRelative < 45);
  const outperformingBenchmarks = hasRelativeBenchmarks && marketRelative >= 62 && sectorRelative >= 58;
  const extendedFromSupport = supportDistance >= 8.5;
  const limitedUpside = rewardDistance < 4.5 || rewardRisk < 1.35;
  const weakSwingSetup = scoreSwingSetup(candidate) < 48;
  const elevatedBinaryRisk = eventRisk >= 45 || filingRisk >= 45;
  const highVolatility = candidate.technical.atrPercent >= 6.5 || partial.risk >= 66;
  const weakConfirmation =
    dataCompleteness < 58 ||
    candidate.news.headlineCount === 0 ||
    (candidate.news.catalystScore < 52 && candidate.news.sentimentScore < 55);
  const scoreAdjustment =
    (limitedUpside ? -8 : rewardRisk >= 2.2 && rewardDistance >= 6 ? 4 : 0) +
    (weakSwingSetup ? -6 : 0) +
    (underperformingBenchmarks ? -7 : outperformingBenchmarks ? 4 : hasRelativeBenchmarks ? 0 : -3) +
    (extendedFromSupport ? -4 : supportDistance <= 5.5 ? 2 : 0) +
    (elevatedBinaryRisk ? -8 : 0) +
    (highVolatility ? -4 : 0) +
    (weakConfirmation ? -5 : dataCompleteness >= 78 ? 3 : 0);
  const confidenceAdjustment =
    (dataCompleteness >= 78 ? 5 : dataCompleteness >= 62 ? 1 : -8) +
    (underperformingBenchmarks ? -5 : hasRelativeBenchmarks ? 2 : -2) +
    (limitedUpside ? -4 : 1) +
    (weakSwingSetup ? -5 : 0) +
    (elevatedBinaryRisk ? -7 : 0);
  const riskAdjustment =
    (extendedFromSupport ? 5 : 0) +
    (limitedUpside ? 4 : 0) +
    (weakSwingSetup ? 5 : 0) +
    (underperformingBenchmarks ? 4 : 0) +
    (elevatedBinaryRisk ? 8 : 0) +
    (highVolatility ? 6 : 0) -
    (dataCompleteness >= 78 && rewardRisk >= 1.8 ? 3 : 0);
  const cap = Math.min(
    100,
    limitedUpside ? 72 : 100,
    weakSwingSetup ? 74 : 100,
    underperformingBenchmarks ? 76 : 100,
    elevatedBinaryRisk ? 70 : 100,
    dataCompleteness < 50 ? 68 : 100,
    highVolatility && rewardRisk < 1.8 ? 74 : 100,
  );
  const notes = [
    limitedUpside
      ? `Reward/risk is thin at ${round(rewardRisk, 1)}R with ${round(rewardDistance, 1)}% upside to resistance.`
      : `Reward/risk is ${round(rewardRisk, 1)}R with ${round(rewardDistance, 1)}% upside to resistance.`,
    !hasRelativeBenchmarks
      ? "Benchmark-relative strength was not available, so the model treats that signal as neutral and caps conviction."
      : underperformingBenchmarks
      ? `Relative strength is weak versus market/sector benchmarks (${marketRelative}/${sectorRelative}).`
      : `Relative strength clears benchmark checks (${marketRelative}/${sectorRelative}).`,
    dataCompleteness < 58
      ? `Data completeness is limited at ${dataCompleteness}/100, so conviction is capped.`
      : `Data completeness is ${dataCompleteness}/100 across price, fundamentals, catalysts, events, and filings.`,
  ];

  if (elevatedBinaryRisk) {
    notes.push("Event or SEC filing risk is elevated, so the score is capped until the binary risk clears.");
  }

  if (weakSwingSetup) {
    notes.push("Swing setup quality is below the preferred threshold, so the model lowers conviction even if the company looks interesting.");
  }

  if (extendedFromSupport) {
    notes.push(`Price is ${round(supportDistance, 1)}% above support, increasing entry discipline risk.`);
  }

  return {
    cap,
    confidenceAdjustment,
    dataCompleteness,
    notes,
    riskAdjustment,
    scoreAdjustment,
  };
}

function getMarketRegime(candidates: EquityCandidate[]) {
  if (candidates.length === 0) {
    return "balanced";
  }

  const average =
    candidates.reduce((total, candidate) => total + candidate.market.marketRegimeScore, 0) /
    candidates.length;

  if (average >= 68) return "risk-on";
  if (average <= 55) return "defensive";
  return "balanced";
}

function buildReasons(candidate: EquityCandidate, scores: ScoreBreakdown) {
  const quality = predictionQualityAdjustment(candidate, {
    technical: scores.technical,
    financial: scores.financial,
    news: scores.news,
    macro: scores.macro,
    liquidity: scores.liquidity,
    risk: scores.risk,
  });
  const reasons = [
    `Technical setup scores ${scores.technical}/100 with price near ${round(candidate.technical.price, 2)}, 90-day relative strength at ${candidate.technical.relativeStrength90d}, market-relative strength at ${candidate.technical.relativeStrengthVsMarket ?? 50}, and sector-relative strength at ${candidate.technical.relativeStrengthVsSector ?? 50}.`,
    `Financial quality scores ${scores.financial}/100, supported by ${candidate.financials.revenueGrowth}% revenue growth and ${candidate.financials.earningsGrowth}% earnings growth.`,
    `News and catalyst tone scores ${scores.news}/100 with ${candidate.news.headlineCount} tracked headlines, ${candidate.news.riskFlagCount} risk flags, and ${candidate.news.catalystTags?.length ? `catalysts including ${candidate.news.catalystTags.slice(0, 2).join(" and ")}` : "no standout catalyst tag"}.`,
    `Macro backdrop scores ${scores.macro}/100 for ${candidate.sector}, using market breadth, rates pressure, FRED, BLS, and Treasury context where available.`,
    `Prediction quality check: ${quality.notes.join(" ")}`,
  ];

  if ((candidate.news.eventRiskScore ?? 0) >= 35) {
    reasons.push("Upcoming event or headline risk is elevated, so the setup needs tighter entry discipline.");
  }

  if ((candidate.news.filingRiskScore ?? 0) >= 35) {
    reasons.push("Recent SEC filing activity raises risk and reduces catalyst quality until the filing impact is clearer.");
  }

  if (scores.risk >= 60) {
    reasons.push("Risk is elevated, so the model requires cleaner entry discipline and smaller sizing.");
  } else if (scores.risk <= 35) {
    reasons.push("Risk is comparatively mild because volatility and support distance are controlled.");
  }

  return reasons;
}

function buildCalibrationReasons(calibration: ReturnType<typeof applyScoreCalibration>) {
  if (calibration.appliedRules.length === 0) {
    return [];
  }

  return calibration.appliedRules.map(
    (rule) =>
      `${rule.label} applied: score -${rule.scorePenalty}, confidence -${rule.confidencePenalty}, risk +${rule.riskAdjustment}.`,
  );
}

function buildOpportunity(
  candidate: EquityCandidate,
  scores: ScoreBreakdown,
  calibration: ReturnType<typeof applyScoreCalibration>,
  asOf: Date,
  source: AgentDataSource,
) {
  const { technical } = candidate;
  const quality = predictionQualityAdjustment(candidate, {
    technical: scores.technical,
    financial: scores.financial,
    news: scores.news,
    macro: scores.macro,
    liquidity: scores.liquidity,
    risk: scores.risk,
  });
  const entryLow = Math.max(technical.support * 1.005, technical.price * 0.985);
  const entryHigh = technical.price * 1.012;
  const eventRiskDrag = (candidate.news.eventRiskScore ?? 0) >= 45 ? 0.92 : 1;
  const stopRiskPct = clamp(technical.atrPercent * 1.35, 4, scores.risk >= 68 ? 10 : 12) / 100;
  const technicalStop = entryLow * (1 - stopRiskPct);
  const structuralStop = technical.support * 0.985;
  const stopLoss = Math.max(structuralStop, technicalStop);
  const riskDollars = Math.max(entryLow - stopLoss, entryLow * 0.035);
  const resistanceTarget = technical.resistance * 0.99 * eventRiskDrag;
  const minimumRewardTarget = entryLow + riskDollars * (quality.dataCompleteness >= 70 ? 1.75 : 1.45);
  const maxTargetMultiple = scores.risk >= 68 ? 1.12 : quality.dataCompleteness < 58 ? 1.14 : 1.18;
  const targetPrice = Math.min(Math.max(resistanceTarget, minimumRewardTarget), entryLow * maxTargetMultiple);
  const expectedGain = ((targetPrice - entryLow) / entryLow) * 100;
  const expectedLoss = ((entryLow - stopLoss) / entryLow) * 100;
  const holdingPeriodDays = Math.round(clamp(8 + (scores.risk / 100) * 18, 8, 28));
  const rewardRisk = expectedLoss > 0 ? expectedGain / expectedLoss : expectedGain;
  const explanation = [
    `${candidate.symbol} ranks highly because trend, market-relative strength, fundamentals, catalyst tone, and macro context are aligned better than most names in the ${source === "fmp" ? "live FMP-screened universe" : "mock universe"}.`,
    `The modeled plan shows about ${round(expectedGain, 1)}% potential upside versus ${round(expectedLoss, 1)}% planned downside, or roughly ${round(rewardRisk, 1)}R reward/risk.`,
    `Prediction quality review: ${quality.notes.join(" ")}`,
    ...buildReasons(candidate, scores).slice(0, 3),
    calibration.appliedRules.length > 0
      ? `Backtest calibration lowered this setup by ${calibration.totalScorePenalty} score points because similar risk patterns have been less reliable historically.`
      : "No active backtest penalty was triggered for this setup.",
    source === "fmp"
      ? "This analysis uses live market/fundamental inputs where available, but it still requires backtesting and forward outcome tracking before it should be treated as verified."
      : "This is mock analysis only; live execution should wait for real market data, filings, news, and risk checks.",
  ].join(" ");

  return {
    id: mockUuid("opportunity", `${asOf.toISOString().slice(0, 10)}:${candidate.symbol}`),
    symbol: candidate.symbol,
    asset_type: "stock" as const,
    score: scores.composite,
    confidence: scores.confidence,
    risk_score: scores.risk,
    entry_low: round(entryLow, 2),
    entry_high: round(entryHigh, 2),
    target_price: round(targetPrice, 2),
    stop_loss: round(stopLoss, 2),
    expected_gain: round(Math.max(expectedGain, 0), 1),
    expected_loss: round(Math.max(expectedLoss, 0), 1),
    holding_period_days: holdingPeriodDays,
    explanation,
    created_at: asOf.toISOString(),
  } satisfies OpportunityRow;
}

function scoreCandidate(candidate: EquityCandidate): ScoreBreakdown {
  const initialPartial = {
    technical: Math.round(scoreTechnical(candidate)),
    financial: Math.round(scoreFinancials(candidate)),
    news: Math.round(scoreNews(candidate)),
    macro: Math.round(scoreMacro(candidate)),
    liquidity: Math.round(scoreLiquidity(candidate)),
    risk: Math.round(scoreRisk(candidate)),
  };
  const quality = predictionQualityAdjustment(candidate, initialPartial);
  const partial = {
    ...initialPartial,
    risk: Math.round(clamp(initialPartial.risk + quality.riskAdjustment)),
  };
  const confidence = Math.round(
    clamp(scoreConfidence(partial) + quality.confidenceAdjustment),
  );
  const supportDistance = ((candidate.technical.price - candidate.technical.support) / candidate.technical.price) * 100;
  const rewardDistance = ((candidate.technical.resistance - candidate.technical.price) / candidate.technical.price) * 100;
  const rewardRiskScore = clamp(
    42 +
      (rewardDistance / Math.max(supportDistance, 1)) * 16 +
      (candidate.technical.relativeStrengthVsMarket ?? 50) * 0.12 +
      (candidate.technical.relativeStrengthVsSector ?? 50) * 0.1 -
      partial.risk * 0.24,
    0,
    100,
  );
  const marketRelative = candidate.technical.relativeStrengthVsMarket ?? 50;
  const sectorRelative = candidate.technical.relativeStrengthVsSector ?? 50;
  const benchmarkAdjustment = clamp(
    (marketRelative - 50) * 0.08 + (sectorRelative - 50) * 0.07,
    -6,
    6,
  );
  const catalystAdjustment = clamp(
    ((candidate.news.catalystScore ?? 50) - 50) * 0.05 -
      (candidate.news.eventRiskScore ?? 0) * 0.035 -
      (candidate.news.filingRiskScore ?? 0) * 0.03,
    -7,
    5,
  );
  const swingSetupScore = scoreSwingSetup(candidate);
  const rawComposite = Math.round(
    clamp(
      partial.technical * 0.27 +
        swingSetupScore * 0.18 +
        partial.financial * 0.16 +
        partial.news * 0.15 +
        partial.macro * 0.1 +
        partial.liquidity * 0.05 +
        rewardRiskScore * 0.05 +
        (100 - partial.risk) * 0.04 +
        benchmarkAdjustment +
        catalystAdjustment,
    ),
  );
  const composite = Math.round(clamp(Math.min(rawComposite + quality.scoreAdjustment, quality.cap)));

  return { ...partial, confidence, composite };
}

export function runDailyRankingAgent({
  asOf = new Date(),
  limit = 30,
}: RunOptions = {}): AgentRunResult {
  const universe = getMockEquityUniverse(asOf);
  return rankEquityCandidates(universe, {
    asOf,
    limit,
    source: "mock",
    dataQuality: {
      priceData: "mock",
      financialData: "mock",
      macroData: "mock",
      newsData: "mock",
      eventData: "mock",
      secData: "mock",
      notes: [
        "Mock provider mode is active. No external market-data provider was called.",
        "Use /api/agent/daily-rankings?source=fmp after adding FMP_API_KEY to run with live FMP inputs.",
      ],
    },
    summaryPrefix: "Mock morning agent",
  });
}

export function rankEquityCandidates(
  universe: EquityCandidate[],
  {
    asOf = new Date(),
    limit = 30,
    source = "mock",
    dataQuality = {
      priceData: "mock",
      financialData: "mock",
      macroData: "mock",
      newsData: "mock",
      eventData: "mock",
      secData: "mock",
      notes: ["Mock provider mode is active."],
    },
    summaryPrefix,
  }: RankOptions = {},
): AgentRunResult {
  const uniqueUniverse = dedupeUniverseBySymbol(universe);
  const effectiveDataQuality = {
    ...dataQuality,
    marketCoverage: dataQuality.marketCoverage ?? {
      status: "thin" as const,
      requestedUniverseLimit: uniqueUniverse.length,
      screenerCount: uniqueUniverse.length,
      detailedCandidateTarget: uniqueUniverse.length,
      detailedCandidateCount: uniqueUniverse.length,
      qualifiedCandidateCount: uniqueUniverse.length,
      rankedCandidateCount: uniqueUniverse.length,
      minimumScreenerCount: uniqueUniverse.length,
      minimumDetailedCandidateCount: uniqueUniverse.length,
      warning: "Mock mode or direct-symbol mode did not scan the broad live market.",
    },
  };
  const marketRegime = getMarketRegime(uniqueUniverse);
  const runId = mockUuid(`${source}-agent-run`, asOf.toISOString().slice(0, 10));
  const ranked = uniqueUniverse
    .map((candidate) => {
      const rawScores = scoreCandidate(candidate);
      const calibration = applyScoreCalibration(candidate, rawScores);
      const scores = calibration.scores;
      const opportunity = buildOpportunity(candidate, scores, calibration, asOf, source);

      return {
        candidate,
        opportunity,
        scores,
        rawScores,
        calibration: calibration.appliedRules,
        reasons: [...buildReasons(candidate, scores), ...buildCalibrationReasons(calibration)],
      };
    })
    .sort((a, b) => b.scores.composite - a.scores.composite)
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    })) satisfies RankedEquityOpportunity[];
  const calibratedCandidateCount = ranked.filter((item) => item.calibration.length > 0).length;
  const dataQualityWithCalibration = {
    ...effectiveDataQuality,
    notes: [
      ...effectiveDataQuality.notes,
      calibratedCandidateCount > 0
        ? `Backtest calibration adjusted ${calibratedCandidateCount} of the selected ${ranked.length} opportunities before scores reached the UI.`
        : "Backtest calibration was checked; no selected opportunities triggered an active penalty.",
    ],
  };

  return {
    runId,
    asOf: asOf.toISOString(),
    dataSource: source,
    dataQuality: dataQualityWithCalibration,
    universeCount: uniqueUniverse.length,
    selectedCount: ranked.length,
    marketRegime,
    summary: `${summaryPrefix ?? "Morning agent"} ranked ${uniqueUniverse.length} unique US stocks and selected the top ${ranked.length} using technicals, company financials, news/catalyst tone, macro/government context, liquidity, reward/risk, benchmark-relative strength, data-completeness caps, event-risk checks, and active backtest calibration penalties.`,
    costEstimate: estimateDailyAgentCost({ selectedCount: ranked.length }),
    opportunities: ranked.map((item) => item.opportunity),
    rankings: ranked,
  };
}

export function createDailyMockOpportunityRows(asOf: Date = new Date()) {
  return runDailyRankingAgent({ asOf, limit: 30 }).opportunities;
}

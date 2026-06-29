import type { AssetType as DatabaseAssetType, OpportunityRow } from "./database.types";
import {
  getBeginnerLesson,
  getDataFreshnessProfile,
  getScoreMovement,
  getSectorForSymbol,
  getSetupPatternForOpportunity,
  type SectorName,
  type SetupPattern,
} from "./market-intelligence";
import { mockOpportunities } from "./mock-data";

export type AssetType = "US Stock" | "ETF" | "Crypto";

export type Opportunity = {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  opportunityScore: number;
  confidenceScore: number;
  riskScore: number;
  scoreLabel: string;
  confidenceLabel: string;
  dataFreshness: ReturnType<typeof getDataFreshnessProfile>;
  riskLabel: string;
  rankingSummary: string;
  entryRange: string;
  entryLow: number;
  entryHigh: number;
  targetPrice: string;
  targetPriceValue: number;
  stopLoss: string;
  stopLossValue: number;
  currentPrice: string;
  holdingPeriodDays: number;
  timeHorizon: string;
  estimatedBuyWindow: string;
  estimatedSellWindow: string;
  tradeQuality: "Excellent" | "Strong" | "Balanced" | "Speculative";
  setup: string;
  setupPattern: SetupPattern;
  sector: SectorName;
  thesis: string;
  potentialGain: string;
  expectedGainValue: number;
  potentialLoss: string;
  expectedLossValue: number;
  scoreMovement: ReturnType<typeof getScoreMovement>;
  beginnerLesson: ReturnType<typeof getBeginnerLesson>;
  aiExplanation: string;
  analysisProfile: {
    followUpChecks: string[];
    invalidationSignals: string[];
    keyStrengths: string[];
    readinessLabel: string;
    readinessScore: number;
    readinessTone: "positive" | "neutral" | "caution";
    rewardRiskLabel: string;
    summary: string;
    watchouts: string[];
  };
  historicalPerformance: {
    label: string;
    value: string;
    tone: "positive" | "neutral" | "caution";
  }[];
};

const assetTypeLabels: Record<DatabaseAssetType, AssetType> = {
  stock: "US Stock",
  etf: "ETF",
  crypto: "Crypto",
};

const symbolNames: Record<string, string> = {
  AAPL: "Apple Inc.",
  ADBE: "Adobe Inc.",
  AMD: "Advanced Micro Devices Inc.",
  AMZN: "Amazon.com Inc.",
  AVGO: "Broadcom Inc.",
  BA: "Boeing Co.",
  BTC: "Bitcoin",
  CAT: "Caterpillar Inc.",
  COP: "ConocoPhillips",
  COST: "Costco Wholesale",
  CRM: "Salesforce Inc.",
  CRWD: "CrowdStrike Holdings Inc.",
  CVX: "Chevron Corp.",
  ETH: "Ethereum",
  FCX: "Freeport-McMoRan Inc.",
  GE: "GE Aerospace",
  GOOGL: "Alphabet Inc.",
  HD: "Home Depot Inc.",
  ISRG: "Intuitive Surgical Inc.",
  IWM: "iShares Russell 2000 ETF",
  JPM: "JPMorgan Chase & Co.",
  LIN: "Linde plc",
  LLY: "Eli Lilly and Co.",
  MA: "Mastercard Inc.",
  MCD: "McDonald's Corp.",
  META: "Meta Platforms",
  MSFT: "Microsoft Corp.",
  NEE: "NextEra Energy Inc.",
  NFLX: "Netflix Inc.",
  NOW: "ServiceNow Inc.",
  NVDA: "NVIDIA Corp.",
  ORCL: "Oracle Corp.",
  PANW: "Palo Alto Networks Inc.",
  PGR: "Progressive Corp.",
  PLD: "Prologis Inc.",
  QQQ: "Invesco QQQ Trust",
  SBUX: "Starbucks Corp.",
  SOL: "Solana",
  SPY: "SPDR S&P 500 ETF",
  TMO: "Thermo Fisher Scientific Inc.",
  TSLA: "Tesla Inc.",
  UBER: "Uber Technologies Inc.",
  UNH: "UnitedHealth Group Inc.",
  V: "Visa Inc.",
  WMT: "Walmart Inc.",
  XOM: "Exxon Mobil Corp.",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getTradeQuality(row: OpportunityRow): Opportunity["tradeQuality"] {
  if (row.score >= 90 && row.risk_score <= 45) return "Excellent";
  if (row.score >= 82) return "Strong";
  if (row.risk_score >= 60) return "Speculative";
  return "Balanced";
}

function getSetup(row: OpportunityRow) {
  if (row.asset_type === "crypto") {
    return "Momentum setup with elevated volatility and strict risk controls.";
  }

  if (row.asset_type === "etf") {
    return "Diversified swing setup with defined entry, target, and stop levels.";
  }

  return "Single-stock swing setup with a clear entry range and downside level.";
}

function getThesis(row: OpportunityRow) {
  return `${row.symbol} ranks ${row.score}/100 with ${row.confidence}/100 confidence and ${row.risk_score}/100 risk, giving beginners a structured setup to review before placing any trade.`;
}

function getScoreLabel(score: number) {
  if (score >= 85) return "High-conviction setup";
  if (score >= 75) return "Strong setup";
  if (score >= 65) return "Watchlist quality";
  return "Speculative watch";
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 85) return "Very strong data support";
  if (confidence >= 75) return "Good data support";
  if (confidence >= 65) return "Moderate data support";
  return "Needs confirmation";
}

function getRiskLabel(riskScore: number) {
  if (riskScore <= 35) return "Lower volatility";
  if (riskScore <= 55) return "Moderate risk";
  if (riskScore <= 70) return "Elevated risk";
  return "High risk";
}

function getRankingSummary(row: OpportunityRow) {
  const reward = row.expected_gain;
  const risk = row.expected_loss;
  const rewardRisk = risk > 0 ? reward / risk : 0;
  const setup = (() => {
    if (row.score >= 80 && row.risk_score <= 45) {
      return "stands out because the setup has strong upside, controlled downside, and a cleaner risk profile";
    }

    if (row.score >= 75) {
      return "ranks well because the trade plan, upside potential, and data support are aligned";
    }

    if (row.confidence >= 82 && row.risk_score <= 45) {
      return "is a steadier watchlist idea because confidence is high and modeled downside is contained";
    }

    if (rewardRisk >= 2.5 && row.risk_score <= 55) {
      return "is worth watching because the reward-to-risk profile is attractive if price enters the planned range";
    }

    if (row.risk_score >= 60) {
      return "is a higher-volatility idea, so the entry range and stop loss matter more than the headline score";
    }

    if (row.confidence < 65) {
      return "has a defined trade plan, but the model wants stronger agreement across the underlying signals";
    }

    return "is a watchlist-quality setup with a clear entry, target, and stop, but not enough strength to rank as high conviction";
  })();

  return `${row.symbol} ${setup}. The model sees about ${reward.toFixed(1)}% potential upside versus ${risk.toFixed(1)}% planned downside, or roughly ${rewardRisk.toFixed(1)}R reward/risk.`;
}

function getAnalysisProfile(row: OpportunityRow): Opportunity["analysisProfile"] {
  const rewardRisk = row.expected_loss > 0 ? row.expected_gain / row.expected_loss : 0;
  const readinessScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        row.score * 0.42 +
          row.confidence * 0.28 +
          Math.min(rewardRisk, 3.5) * 8 -
          row.risk_score * 0.18,
      ),
    ),
  );
  const readinessLabel =
    readinessScore >= 78 && row.risk_score <= 55
      ? "Ready for focused review"
      : readinessScore >= 64
        ? "Watchlist with conditions"
        : "Needs stronger confirmation";
  const readinessTone =
    readinessScore >= 78 && row.risk_score <= 55
      ? "positive"
      : readinessScore >= 64
        ? "neutral"
        : "caution";
  const keyStrengths = [
    row.score >= 78
      ? "Strong overall rank versus the current opportunity list."
      : "Defined setup with enough score strength to keep on the research list.",
    row.confidence >= 75
      ? "Multiple signals agree enough to support deeper review."
      : "The model has a trade plan, but signal agreement is not yet ideal.",
    rewardRisk >= 2
      ? `Reward/risk is attractive at roughly ${rewardRisk.toFixed(1)}R.`
      : "Upside exists, but the reward/risk spread is tighter than ideal.",
  ];
  const watchouts = [
    row.risk_score >= 60
      ? "Risk is elevated, so position size and stop discipline matter more."
      : "Risk is not extreme, but the stop still defines the trade.",
    row.confidence < 70
      ? "Confidence is below the preferred beginner threshold."
      : "Confidence can still change if news, volume, or market regime shifts.",
    rewardRisk < 1.8
      ? "The target does not leave much room for sloppy entries."
      : "Do not chase above the entry range or the reward/risk profile weakens.",
  ];
  const invalidationSignals = [
    `Price moves below the stop loss at ${formatCurrency(row.stop_loss)}.`,
    `Price runs above the entry range before review, especially above ${formatCurrency(row.entry_high)}.`,
    "A new earnings, SEC filing, downgrade, or market-wide risk event changes the setup.",
    "Volume fades while the broader market or sector weakens.",
  ];
  const followUpChecks = [
    "Confirm price is still inside or close to the entry range.",
    "Check today's news and upcoming earnings before placing any order.",
    "Compare position size against the planned stop loss.",
    "Review whether SPY/QQQ and the stock's sector are supporting the move.",
  ];

  return {
    followUpChecks,
    invalidationSignals,
    keyStrengths,
    readinessLabel,
    readinessScore,
    readinessTone,
    rewardRiskLabel: `${rewardRisk.toFixed(1)}R`,
    summary:
      readinessTone === "positive"
        ? "This setup is worth reviewing early, but only if the entry range and stop still fit your plan."
        : readinessTone === "neutral"
          ? "This is useful for the watchlist, but it needs the stated conditions to stay valid."
          : "This should stay lower priority until confirmation improves or risk comes down.",
    watchouts,
  };
}

function getHistoricalPerformance(row: OpportunityRow): Opportunity["historicalPerformance"] {
  const winRate = Math.max(45, Math.min(72, row.confidence - Math.round(row.risk_score / 5)));

  return [
    {
      label: "Similar setups win rate",
      value: `${winRate}%`,
      tone: winRate >= 60 ? "positive" : winRate >= 52 ? "neutral" : "caution",
    },
    {
      label: "Average hold",
      value: `${row.holding_period_days} days`,
      tone: "neutral",
    },
    {
      label: "Volatility profile",
      value: row.risk_score >= 60 ? "High" : row.risk_score >= 45 ? "Moderate" : "Mild",
      tone: row.risk_score >= 60 ? "caution" : "positive",
    },
  ];
}

function getBuyWindow(row: OpportunityRow) {
  if (row.risk_score <= 35) return "Today to 3 trading days";
  if (row.risk_score <= 55) return "Today to 2 trading days";
  return "Intraday confirmation only";
}

function getSellWindow(row: OpportunityRow) {
  const low = Math.max(3, Math.round(row.holding_period_days * 0.65));
  const high = Math.max(low + 2, Math.round(row.holding_period_days * 1.25));

  return `${low} to ${high} trading days`;
}

export function opportunityFromRow(row: OpportunityRow): Opportunity {
  const base = {
    id: row.id,
    symbol: row.symbol,
    name: symbolNames[row.symbol] ?? row.symbol,
    assetType: assetTypeLabels[row.asset_type],
    opportunityScore: row.score,
    confidenceScore: row.confidence,
    riskScore: row.risk_score,
    scoreLabel: getScoreLabel(row.score),
    confidenceLabel: getConfidenceLabel(row.confidence),
    riskLabel: getRiskLabel(row.risk_score),
    rankingSummary: getRankingSummary(row),
    entryRange: `${formatCurrency(row.entry_low)} - ${formatCurrency(row.entry_high)}`,
    entryLow: row.entry_low,
    entryHigh: row.entry_high,
    targetPrice: formatCurrency(row.target_price),
    targetPriceValue: row.target_price,
    stopLoss: formatCurrency(row.stop_loss),
    stopLossValue: row.stop_loss,
    currentPrice: formatCurrency((row.entry_low + row.entry_high) / 2),
    holdingPeriodDays: row.holding_period_days,
    timeHorizon: `${row.holding_period_days} days`,
    estimatedBuyWindow: getBuyWindow(row),
    estimatedSellWindow: getSellWindow(row),
    tradeQuality: getTradeQuality(row),
    setup: getSetup(row),
    thesis: getThesis(row),
    potentialGain: formatPercent(row.expected_gain),
    expectedGainValue: row.expected_gain,
    potentialLoss: `-${row.expected_loss.toFixed(1)}%`,
    expectedLossValue: row.expected_loss,
    aiExplanation: row.explanation,
    analysisProfile: getAnalysisProfile(row),
    historicalPerformance: getHistoricalPerformance(row),
  };

  return {
    ...base,
    beginnerLesson: getBeginnerLesson(base),
    dataFreshness: getDataFreshnessProfile(row.created_at, row.risk_score),
    scoreMovement: getScoreMovement(base),
    sector: getSectorForSymbol(row.symbol),
    setupPattern: getSetupPatternForOpportunity(base),
  };
}

export const opportunities: Opportunity[] = mockOpportunities.map(opportunityFromRow);

export function getOpportunity(symbol: string) {
  return opportunities.find(
    (opportunity) => opportunity.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

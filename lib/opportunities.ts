import type { AssetType as DatabaseAssetType, OpportunityRow } from "./database.types";
import { mockOpportunities } from "./mock-data";

export type AssetType = "US Stock" | "ETF" | "Crypto";

export type Opportunity = {
  symbol: string;
  name: string;
  assetType: AssetType;
  opportunityScore: number;
  confidenceScore: number;
  riskScore: number;
  entryRange: string;
  targetPrice: string;
  stopLoss: string;
  currentPrice: string;
  timeHorizon: string;
  estimatedBuyWindow: string;
  estimatedSellWindow: string;
  tradeQuality: "Excellent" | "Strong" | "Balanced" | "Speculative";
  setup: string;
  thesis: string;
  potentialGain: string;
  potentialLoss: string;
  aiExplanation: string;
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
  return {
    symbol: row.symbol,
    name: symbolNames[row.symbol] ?? row.symbol,
    assetType: assetTypeLabels[row.asset_type],
    opportunityScore: row.score,
    confidenceScore: row.confidence,
    riskScore: row.risk_score,
    entryRange: `${formatCurrency(row.entry_low)} - ${formatCurrency(row.entry_high)}`,
    targetPrice: formatCurrency(row.target_price),
    stopLoss: formatCurrency(row.stop_loss),
    currentPrice: formatCurrency((row.entry_low + row.entry_high) / 2),
    timeHorizon: `${row.holding_period_days} days`,
    estimatedBuyWindow: getBuyWindow(row),
    estimatedSellWindow: getSellWindow(row),
    tradeQuality: getTradeQuality(row),
    setup: getSetup(row),
    thesis: getThesis(row),
    potentialGain: formatPercent(row.expected_gain),
    potentialLoss: `-${row.expected_loss.toFixed(1)}%`,
    aiExplanation: row.explanation,
    historicalPerformance: getHistoricalPerformance(row),
  };
}

export const opportunities: Opportunity[] = mockOpportunities.map(opportunityFromRow);

export function getOpportunity(symbol: string) {
  return opportunities.find(
    (opportunity) => opportunity.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

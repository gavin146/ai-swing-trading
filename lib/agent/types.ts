import type { OpportunityRow } from "@/lib/database.types";
import type { AgentCostEstimate } from "./costs";

export type Sector =
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

export type TechnicalSnapshot = {
  price: number;
  sma20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  atrPercent: number;
  relativeStrength90d: number;
  relativeStrengthVsMarket?: number;
  relativeStrengthVsSector?: number;
  trendQuality?: number;
  breakoutProximity?: number;
  support: number;
  resistance: number;
  volumeTrend: number;
};

export type CompanyFinancialSnapshot = {
  revenueGrowth: number;
  earningsGrowth: number;
  freeCashFlowYield: number;
  debtToEquity: number;
  marginTrend: number;
  revisionScore: number;
  valuationScore: number;
};

export type NewsSnapshot = {
  sentimentScore: number;
  catalystScore: number;
  headlineCount: number;
  riskFlagCount: number;
  catalystTags?: string[];
  eventRiskScore?: number;
  filingRiskScore?: number;
  daysToEarnings?: number | null;
  summary: string;
};

export type MarketAndGovSnapshot = {
  marketRegimeScore: number;
  sectorTrendScore: number;
  economicSurpriseScore: number;
  ratesPressureScore: number;
  breadthScore: number;
  govDataSummary: string;
};

export type EquityCandidate = {
  symbol: string;
  companyName: string;
  sector: Sector;
  averageVolume: number;
  marketCapBillions: number;
  technical: TechnicalSnapshot;
  financials: CompanyFinancialSnapshot;
  news: NewsSnapshot;
  market: MarketAndGovSnapshot;
};

export type AgentDataSource = "mock" | "fmp";

export type ScoreBreakdown = {
  technical: number;
  financial: number;
  news: number;
  macro: number;
  liquidity: number;
  risk: number;
  confidence: number;
  composite: number;
};

export type AppliedCalibrationRule = {
  id: string;
  label: string;
  reason: string;
  scorePenalty: number;
  confidencePenalty: number;
  riskAdjustment: number;
};

export type RankedEquityOpportunity = {
  rank: number;
  candidate: EquityCandidate;
  opportunity: OpportunityRow;
  scores: ScoreBreakdown;
  rawScores: ScoreBreakdown;
  calibration: AppliedCalibrationRule[];
  reasons: string[];
};

export type AgentRunResult = {
  runId: string;
  asOf: string;
  dataSource: AgentDataSource;
  dataQuality: {
    priceData: "mock" | "live" | "partial";
    financialData: "mock" | "live" | "partial";
    macroData: "mock" | "live" | "partial";
    newsData: "mock" | "live" | "partial";
    eventData: "mock" | "live" | "partial";
    secData: "mock" | "live" | "partial";
    marketCoverage?: {
      status: "healthy" | "thin" | "blocked";
      requestedUniverseLimit: number;
      screenerCount: number;
      detailedCandidateTarget: number;
      detailedCandidateCount: number;
      qualifiedCandidateCount: number;
      rankedCandidateCount: number;
      minimumScreenerCount: number;
      minimumDetailedCandidateCount: number;
      warning: string | null;
    };
    notes: string[];
  };
  universeCount: number;
  selectedCount: number;
  marketRegime: "risk-on" | "balanced" | "defensive";
  summary: string;
  costEstimate: AgentCostEstimate;
  opportunities: OpportunityRow[];
  rankings: RankedEquityOpportunity[];
};

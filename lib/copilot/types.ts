export type BrokerageProviderId =
  | "manual_trade_history"
  | "mock_local"
  | "snaptrade"
  | "plaid_investments"
  | "broker_specific";

export type BrokerageConnectionStatus =
  | "not_connected"
  | "instructions_ready"
  | "connected"
  | "reconnect_required"
  | "disabled"
  | "unhealthy"
  | "disconnected";

export type BrokerageCapabilities = {
  canReadAccounts: boolean;
  canReadHoldings: boolean;
  canReadTransactions: boolean;
  canReadBalances: boolean;
  canDisconnect: boolean;
  canRefresh: boolean;
  canPlaceOrders: false;
};

export type ServerCredentialReference = {
  id: string;
  kind: "server_credential_reference";
  providerId: BrokerageProviderId;
};

export type BrokerageConnectionSummary = {
  providerId: BrokerageProviderId;
  displayName: string;
  status: BrokerageConnectionStatus;
  capabilities: BrokerageCapabilities;
  connectionId?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  lastSyncedAt?: string;
  lastHealthyAt?: string;
  serverCredentialRef?: ServerCredentialReference;
  statusMessage?: string;
};

export type PublicBrokerageConnectionSummary = Omit<
  BrokerageConnectionSummary,
  "serverCredentialRef"
>;

export type BrokerageAccount = {
  id: string;
  providerId: BrokerageProviderId;
  connectionId?: string;
  name: string;
  mask?: string;
  type: "taxable" | "ira" | "roth_ira" | "crypto" | "unknown";
  currency: string;
  fetchedAt: string;
  dataAsOf: string;
};

export type PortfolioSnapshotSource =
  | "manual_trade_history"
  | "swingfi_tracker"
  | "mock_local"
  | "future_external_provider";

export type PortfolioPositionPlan = {
  entryPrice: number | null;
  holdingPeriodDays: number | null;
  notes?: string | null;
  opportunityId?: string | null;
  planCreatedAt: string | null;
  planSource:
    | "manual_trade_history"
    | "swingfi_tracker"
    | "swingfi_daily_analysis"
    | "market_structure_estimate";
  stopLoss: number | null;
  targetPrice: number | null;
};

export type PortfolioPositionQuote = {
  dataAsOf: string | null;
  fetchedAt: string | null;
  message?: string;
  source: string;
  status: "fresh" | "stale" | "missing" | "error";
};

export type PortfolioPosition = {
  id: string;
  providerId: BrokerageProviderId;
  accountId?: string;
  symbol: string;
  assetType: "stock" | "etf" | "crypto" | "unknown";
  quantity: number | null;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  costBasis?: number | null;
  marketValue: number | null;
  originalPlan?: PortfolioPositionPlan;
  quote?: PortfolioPositionQuote;
  currency: string;
  openedAt?: string;
  sourceTradeHistoryId?: string;
  unrealizedGainLoss?: number | null;
  fetchedAt: string;
  dataAsOf: string;
};

export type PortfolioCompleteness = {
  level: "empty" | "partial" | "complete";
  missingFields: string[];
  warnings: string[];
};

export type PortfolioSnapshot = {
  id: string;
  userId: string;
  providerId: BrokerageProviderId;
  source: PortfolioSnapshotSource;
  accounts: BrokerageAccount[];
  positions: PortfolioPosition[];
  completeness: PortfolioCompleteness;
  fetchedAt: string;
  dataAsOf: string;
};

export type PublicPortfolioSnapshot = PortfolioSnapshot;

export type PortfolioSyncErrorCode =
  | "unknown_provider"
  | "disabled_provider"
  | "unsupported_provider"
  | "unhealthy_provider"
  | "invalid_input"
  | "sync_failed";

export type PortfolioSyncError = {
  code: PortfolioSyncErrorCode;
  message: string;
  providerId?: BrokerageProviderId;
  retryable: boolean;
};

export type PortfolioSyncResult =
  | {
      ok: true;
      providerId: BrokerageProviderId;
      snapshot: PortfolioSnapshot;
      warnings: string[];
    }
  | {
      ok: false;
      providerId?: BrokerageProviderId;
      error: PortfolioSyncError;
    };

export type DataFreshness = {
  source: string;
  status: "fresh" | "stale" | "missing" | "error";
  fetchedAt: string | null;
  dataAsOf: string | null;
  maxAgeSeconds?: number;
  message?: string;
};

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

export type PortfolioFinding = PortfolioAnalyzerFinding;

export type CopilotReportInput = {
  userId: string;
  snapshot: PortfolioSnapshot;
  findings: PortfolioAnalyzerFinding[];
  freshness: DataFreshness[];
  generatedAt: string;
};

export type ConnectionInstructions = {
  providerId: BrokerageProviderId;
  status: "instructions" | "unsupported" | "disabled";
  message: string;
  expiresAt?: string;
  url?: string;
};

export type BrokerageConnectionHealth = {
  providerId: BrokerageProviderId;
  status: BrokerageConnectionStatus;
  checkedAt: string;
  message: string;
  retryable: boolean;
};

export type BrokerageReadProvider = {
  readonly id: BrokerageProviderId;
  readonly displayName: string;
  readonly capabilities: BrokerageCapabilities;
  isEnabled(): boolean;
  getConnectionInstructions(userId: string): Promise<ConnectionInstructions>;
  getConnectionHealth(userId: string): Promise<BrokerageConnectionHealth>;
  syncPortfolio(userId: string): Promise<PortfolioSyncResult>;
  disconnect(userId: string): Promise<BrokerageConnectionSummary>;
};

export type BrokerageProviderRegistry = {
  listProviders(options?: { includeDisabled?: boolean }): BrokerageConnectionSummary[];
  getProvider(providerId: BrokerageProviderId): BrokerageReadProvider;
  register(provider: BrokerageReadProvider): void;
};

export type PortfolioSnapshotRepository = {
  getLatestSnapshot(args: {
    providerId?: BrokerageProviderId;
    userId: string;
  }): Promise<PortfolioSnapshot | null>;
  saveSnapshot(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot>;
};

export type TimeProvider = {
  now(): Date;
  nowIso(): string;
};

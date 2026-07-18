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
  | "mock_local"
  | "future_external_provider";

export type PortfolioPosition = {
  id: string;
  providerId: BrokerageProviderId;
  accountId?: string;
  symbol: string;
  assetType: "stock" | "etf" | "crypto" | "unknown";
  quantity: number | null;
  averageEntryPrice: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  currency: string;
  openedAt?: string;
  sourceTradeHistoryId?: string;
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

export type PortfolioFinding = {
  id: string;
  severity: "positive" | "watch" | "risk" | "missing_data";
  title: string;
  plainEnglish: string;
  symbol?: string;
  evidence: Array<{
    dataAsOf: string;
    fetchedAt: string;
    label: string;
    source: string;
    value: string;
  }>;
};

export type CopilotReportInput = {
  userId: string;
  snapshot: PortfolioSnapshot;
  findings: PortfolioFinding[];
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

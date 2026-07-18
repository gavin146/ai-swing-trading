import { getCopilotFeatureConfig, type CopilotFeatureConfig } from "./config";
import { UnhealthyBrokerageProviderError } from "./errors";
import { assertServerOnlyModule } from "./server-only";
import {
  type BrokerageCapabilities,
  type BrokerageConnectionSummary,
  type BrokerageReadProvider,
  type PortfolioPosition,
  type PortfolioSyncResult,
  type TimeProvider,
} from "./types";
import { systemTimeProvider } from "./time";
import {
  assertNoTradingCapability,
  assertUserId,
  buildPortfolioCompleteness,
  normalizeBrokerageCapabilities,
  validatePortfolioSnapshot,
} from "./validation";

assertServerOnlyModule("lib/copilot/mock-provider");

type MockProviderOptions = {
  config?: CopilotFeatureConfig;
  displayName?: string;
  enabled?: boolean;
  positions?: Array<Partial<PortfolioPosition> & { symbol: string }>;
  timeProvider?: TimeProvider;
  unhealthy?: boolean;
};

const mockCapabilities: BrokerageCapabilities = normalizeBrokerageCapabilities({
  canDisconnect: true,
  canReadAccounts: true,
  canReadBalances: false,
  canReadHoldings: true,
  canReadTransactions: false,
  canRefresh: true,
});

function assertMockAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("MockBrokerageReadProvider cannot be constructed in production.");
  }
}

function normalizePosition(
  userId: string,
  position: Partial<PortfolioPosition> & { symbol: string },
  index: number,
  providerFetchedAt: string,
): PortfolioPosition {
  const symbol = position.symbol.trim().toUpperCase();
  const quantity = typeof position.quantity === "number" ? position.quantity : null;
  const currentPrice = typeof position.currentPrice === "number" ? position.currentPrice : null;
  const averageEntryPrice =
    typeof position.averageEntryPrice === "number" ? position.averageEntryPrice : null;
  const marketValue =
    typeof position.marketValue === "number"
      ? position.marketValue
      : quantity !== null && currentPrice !== null
        ? Number((quantity * currentPrice).toFixed(2))
        : null;

  return {
    accountId: position.accountId ?? "mock-account",
    assetType: position.assetType ?? "stock",
    averageEntryPrice,
    currency: position.currency ?? "USD",
    currentPrice,
    dataAsOf: position.dataAsOf ?? providerFetchedAt,
    fetchedAt: position.fetchedAt ?? providerFetchedAt,
    id: position.id ?? `${userId}:mock:${symbol}:${index}`,
    marketValue,
    openedAt: position.openedAt,
    providerId: "mock_local",
    quantity,
    sourceTradeHistoryId: position.sourceTradeHistoryId,
    symbol,
  };
}

export class MockBrokerageReadProvider implements BrokerageReadProvider {
  readonly id = "mock_local" as const;
  readonly displayName: string;
  readonly capabilities = mockCapabilities;
  private readonly config: CopilotFeatureConfig;
  private readonly enabled: boolean;
  private readonly positions: Array<Partial<PortfolioPosition> & { symbol: string }>;
  private readonly timeProvider: TimeProvider;
  private readonly unhealthy: boolean;

  constructor(options: MockProviderOptions = {}) {
    assertMockAllowed();
    assertNoTradingCapability(mockCapabilities);
    this.config = options.config ?? getCopilotFeatureConfig();
    this.displayName = options.displayName ?? "Mock local brokerage";
    this.enabled = options.enabled ?? true;
    this.positions =
      options.positions ??
      [
        {
          averageEntryPrice: 182.5,
          currentPrice: 188.25,
          quantity: 3,
          symbol: "AMZN",
        },
      ];
    this.timeProvider = options.timeProvider ?? systemTimeProvider;
    this.unhealthy = options.unhealthy ?? false;
  }

  isEnabled() {
    return (
      this.enabled &&
      this.config.copilotEnabled &&
      this.config.brokerageConnectionsEnabled
    );
  }

  async getConnectionInstructions(userId: string) {
    assertUserId(userId);

    if (!this.isEnabled()) {
      return {
        message: "Mock local provider is disabled.",
        providerId: this.id,
        status: "disabled" as const,
      };
    }

    return {
      message:
        "Mock provider is available for local development and contract tests only.",
      providerId: this.id,
      status: "instructions" as const,
    };
  }

  async getConnectionHealth(userId: string) {
    assertUserId(userId);

    if (this.unhealthy) {
      return {
        checkedAt: this.timeProvider.nowIso(),
        message: "Mock provider was configured as unhealthy for contract testing.",
        providerId: this.id,
        retryable: true,
        status: "unhealthy" as const,
      };
    }

    return {
      checkedAt: this.timeProvider.nowIso(),
      message: this.isEnabled()
        ? "Mock provider is healthy."
        : "Mock provider is disabled.",
      providerId: this.id,
      retryable: false,
      status: this.isEnabled() ? "connected" as const : "disabled" as const,
    };
  }

  async syncPortfolio(userId: string): Promise<PortfolioSyncResult> {
    const cleanUserId = assertUserId(userId);
    const health = await this.getConnectionHealth(cleanUserId);

    if (health.status === "unhealthy") {
      throw new UnhealthyBrokerageProviderError(this.id, health.message);
    }

    if (!this.isEnabled()) {
      return {
        error: {
          code: "disabled_provider",
          message: "Mock provider is disabled.",
          providerId: this.id,
          retryable: false,
        },
        ok: false,
        providerId: this.id,
      };
    }

    const fetchedAt = this.timeProvider.nowIso();
    const positions = this.positions.map((position, index) =>
      normalizePosition(cleanUserId, position, index, fetchedAt),
    );
    const dataAsOf =
      positions
        .map((position) => position.dataAsOf)
        .sort()
        .at(-1) ?? fetchedAt;
    const snapshot = validatePortfolioSnapshot({
      accounts: [
        {
          currency: "USD",
          dataAsOf,
          fetchedAt,
          id: "mock-account",
          name: "Mock local account",
          providerId: this.id,
          type: "unknown",
        },
      ],
      completeness: buildPortfolioCompleteness(positions),
      dataAsOf,
      fetchedAt,
      id: `${cleanUserId}:mock:${fetchedAt}`,
      positions,
      providerId: this.id,
      source: "mock_local",
      userId: cleanUserId,
    });

    return {
      ok: true,
      providerId: this.id,
      snapshot,
      warnings: snapshot.completeness.warnings,
    };
  }

  async disconnect(userId: string): Promise<BrokerageConnectionSummary> {
    assertUserId(userId);

    return {
      capabilities: {
        ...this.capabilities,
        canPlaceOrders: false,
      },
      disconnectedAt: this.timeProvider.nowIso(),
      displayName: this.displayName,
      providerId: this.id,
      status: "disconnected",
      statusMessage: "Mock provider disconnected for this local session.",
    };
  }
}

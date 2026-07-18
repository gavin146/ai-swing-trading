import type {
  BrokerageCapabilities,
  BrokerageProviderId,
  PortfolioCompleteness,
  PortfolioPosition,
  PortfolioSnapshot,
} from "./types";

const providerIds = new Set<BrokerageProviderId>([
  "manual_trade_history",
  "mock_local",
  "snaptrade",
  "plaid_investments",
  "broker_specific",
]);

export function isBrokerageProviderId(value: unknown): value is BrokerageProviderId {
  return typeof value === "string" && providerIds.has(value as BrokerageProviderId);
}

export function assertBrokerageProviderId(value: unknown): BrokerageProviderId {
  if (!isBrokerageProviderId(value)) {
    throw new Error(`Invalid brokerage provider id: ${String(value ?? "")}.`);
  }

  return value;
}

export function assertUserId(value: unknown) {
  const userId = String(value ?? "").trim();

  if (!userId) {
    throw new Error("A user id is required.");
  }

  return userId;
}

export function normalizeBrokerageCapabilities(
  value: Partial<BrokerageCapabilities> = {},
): BrokerageCapabilities {
  return {
    canDisconnect: Boolean(value.canDisconnect),
    canPlaceOrders: false,
    canReadAccounts: Boolean(value.canReadAccounts),
    canReadBalances: Boolean(value.canReadBalances),
    canReadHoldings: Boolean(value.canReadHoldings),
    canReadTransactions: Boolean(value.canReadTransactions),
    canRefresh: Boolean(value.canRefresh),
  };
}

export function assertNoTradingCapability(capabilities: BrokerageCapabilities) {
  if (capabilities.canPlaceOrders !== false) {
    throw new Error("BrokerageReadProvider cannot expose order placement capability.");
  }
}

export function buildPortfolioCompleteness(positions: PortfolioPosition[]): PortfolioCompleteness {
  if (positions.length === 0) {
    return {
      level: "empty",
      missingFields: [],
      warnings: ["No positions were returned by this provider."],
    };
  }

  const missingFields = new Set<string>();

  positions.forEach((position) => {
    if (position.quantity === null) missingFields.add("quantity");
    if (position.averageEntryPrice === null) missingFields.add("averageEntryPrice");
    if (position.currentPrice === null) missingFields.add("currentPrice");
    if (position.marketValue === null) missingFields.add("marketValue");
  });

  const missing = Array.from(missingFields).sort();

  return {
    level: missing.length ? "partial" : "complete",
    missingFields: missing,
    warnings: missing.length
      ? [`Provider returned partial portfolio data missing: ${missing.join(", ")}.`]
      : [],
  };
}

export function validatePortfolioSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  assertUserId(snapshot.userId);
  assertBrokerageProviderId(snapshot.providerId);

  if (!snapshot.fetchedAt || Number.isNaN(new Date(snapshot.fetchedAt).getTime())) {
    throw new Error("Portfolio snapshot requires a valid fetchedAt timestamp.");
  }

  if (!snapshot.dataAsOf || Number.isNaN(new Date(snapshot.dataAsOf).getTime())) {
    throw new Error("Portfolio snapshot requires a valid dataAsOf timestamp.");
  }

  snapshot.positions.forEach((position) => {
    if (!position.symbol.trim()) {
      throw new Error("Portfolio position requires a symbol.");
    }

    if (!position.fetchedAt || !position.dataAsOf) {
      throw new Error("Portfolio position requires fetchedAt and dataAsOf timestamps.");
    }
  });

  return snapshot;
}

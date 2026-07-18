import type {
  BrokerageConnectionSummary,
  PortfolioSnapshot,
  PublicBrokerageConnectionSummary,
  PublicPortfolioSnapshot,
} from "./types";

export function toPublicBrokerageConnectionSummary(
  summary: BrokerageConnectionSummary,
): PublicBrokerageConnectionSummary {
  const { serverCredentialRef: _serverCredentialRef, ...publicSummary } = summary;

  return {
    ...publicSummary,
    capabilities: {
      ...publicSummary.capabilities,
      canPlaceOrders: false,
    },
  };
}

export function toPublicPortfolioSnapshot(snapshot: PortfolioSnapshot): PublicPortfolioSnapshot {
  return {
    ...snapshot,
    positions: snapshot.positions.map((position) => ({
      ...position,
      symbol: position.symbol.trim().toUpperCase(),
    })),
  };
}

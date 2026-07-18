# SwingFi Copilot Brokerage Provider Adapter Guide

Last updated: 2026-07-17

SwingFi Copilot provider adapters are read-only data adapters. They normalize a user's portfolio data into SwingFi-owned contracts so the rest of Copilot does not care whether the source is manual `trade_history`, SnapTrade, Plaid Investments, or a future broker-specific API.

No adapter may place trades, simulate live trading, move money, collect account passwords, or expose raw provider credentials to browser-safe objects.

## Current Adapter Status

Implemented now:

- Core TypeScript contracts in `lib/copilot/types.ts`.
- Dependency-injected registry in `lib/copilot/provider-registry.ts`.
- Local/test-only mock provider in `lib/copilot/mock-provider.ts`.
- Safe feature config in `lib/copilot/config.ts`.
- Validation and public serialization helpers in `lib/copilot/validation.ts` and `lib/copilot/serialization.ts`.

Not implemented yet:

- SnapTrade adapter.
- Plaid Investments adapter.
- Broker-specific adapter.
- Provider credential vault.
- Database persistence.
- Customer UI.
- API routes.
- Live trading.
- Paper trading.

## How A Future Provider Plugs Into The Registry

1. Implement the `BrokerageReadProvider` contract from `lib/copilot/types.ts`.
2. Keep the adapter under `lib/copilot/providers/<provider-name>-provider.ts`.
3. Add the adapter to the registry construction point only after feature flags and legal/compliance approval are ready.
4. Keep external SDK imports inside the adapter file, not in shared contracts.
5. Return only normalized SwingFi contracts from provider methods.
6. Do not leak raw provider responses to client APIs.

Expected provider shape:

```ts
export class FutureProvider implements BrokerageReadProvider {
  readonly id = "snaptrade";
  readonly displayName = "SnapTrade";
  readonly capabilities = normalizeBrokerageCapabilities({
    canDisconnect: true,
    canReadAccounts: true,
    canReadBalances: true,
    canReadHoldings: true,
    canReadTransactions: true,
    canRefresh: true,
  });

  isEnabled() {
    return flags.copilotEnabled && flags.brokerageConnectionsEnabled;
  }

  async getConnectionInstructions(userId: string) {}
  async getConnectionHealth(userId: string) {}
  async syncPortfolio(userId: string) {}
  async disconnect(userId: string) {}
}
```

`normalizeBrokerageCapabilities()` always forces `canPlaceOrders: false`.

## Required Normalized Fields

Every `PortfolioSnapshot` must include:

- `id`
- `userId`
- `providerId`
- `source`
- `accounts`
- `positions`
- `completeness`
- `fetchedAt`
- `dataAsOf`

Every `PortfolioPosition` must include:

- `id`
- `providerId`
- `symbol`
- `assetType`
- `quantity`
- `averageEntryPrice`
- `currentPrice`
- `marketValue`
- `currency`
- `fetchedAt`
- `dataAsOf`

Optional fields may be `null` when unavailable, but they must not be omitted if the contract requires them.

Every `BrokerageAccount` must include:

- `id`
- `providerId`
- `name`
- `type`
- `currency`
- `fetchedAt`
- `dataAsOf`

## Connection Lifecycle

Connection:

- A provider may return `getConnectionInstructions()` with a safe URL or instructions.
- Browser-safe connection responses must not include tokens, refresh tokens, usernames, passwords, API secrets, or provider secrets.
- If a provider needs credentials, store only an opaque `ServerCredentialReference` server-side.

Reconnect:

- `getConnectionHealth()` must return `reconnect_required` when the provider needs a user refresh.
- Reconnect flows must be idempotent and safe to retry.

Sync:

- `syncPortfolio(userId)` returns `PortfolioSyncResult`.
- Sync must be read-only.
- Sync must scope all data to the authenticated `userId`.
- Sync should return partial snapshots with warnings rather than failing when optional fields are unavailable.

Error:

- Unknown provider: `UnknownBrokerageProviderError`.
- Disabled provider: `DisabledBrokerageProviderError`.
- Unsupported provider: `UnsupportedBrokerageProviderError`.
- Unhealthy provider: `UnhealthyBrokerageProviderError`.
- External provider errors should map to `PortfolioSyncError` with `retryable` set correctly.

Disconnect:

- `disconnect(userId)` should disconnect or mark disconnected.
- Disconnect should not delete local audit/report history unless the user requests deletion.
- Disconnect should never expose deleted credential values.

Deletion:

- Provider data deletion should be explicit and separate from disconnect.
- Future deletion must remove provider credentials, provider connection metadata, and user-owned provider snapshots according to privacy policy.

## `fetched_at` And `data_as_of` Semantics

Every provider datum needs both:

- `fetchedAt`: when SwingFi fetched or generated the normalized datum.
- `dataAsOf`: when the provider says the underlying market/account data was current.

Examples:

- FMP quote fetched at 8:30:05 AM with latest quote at 8:29:58 AM:
  - `fetchedAt = 8:30:05`
  - `dataAsOf = 8:29:58`
- Manual tracked trade created last week and enriched now:
  - `fetchedAt = now`
  - `dataAsOf = latest quote/candle timestamp if available, otherwise now with a missing/stale freshness warning`
- Provider returns no timestamp:
  - Use fetch time as a fallback and add a freshness warning.

## Idempotency Expectations

Provider sync should be safe to retry:

- Re-running sync should not duplicate active connection rows.
- Snapshot IDs should be generated deterministically or saved with clear uniqueness rules when persistence is added.
- Disconnect should be safe to call more than once.
- Reconnect should replace expired references rather than creating multiple active credentials.

## Rate-Limit And Retry Boundaries

Adapters must:

- Respect provider documented rate limits.
- Use bounded retries only for retryable network/429/5xx failures.
- Avoid unbounded loops.
- Avoid retrying credential, authorization, 400, or unsupported-account failures.
- Return partial data when safe.
- Record stale or missing data through `DataFreshness` instead of hiding it.

## Logging And Redaction Rules

Never log:

- Raw usernames.
- Passwords.
- Access tokens.
- Refresh tokens.
- API secrets.
- Provider account numbers.
- Full brokerage account identifiers.
- Full provider raw responses if they may contain sensitive fields.

Allowed logs:

- Provider id.
- User id only in server-side operational logs where already used by the app.
- Connection status.
- Sync status.
- Retryable/non-retryable error category.
- Redacted account mask.
- Counts of accounts/positions.
- Freshness status.

## Required Contract Tests

Every provider must pass contract tests for:

- Registration and lookup.
- Duplicate registration rejection.
- Disabled provider behavior.
- Unknown provider behavior.
- Healthy sync success.
- Unhealthy provider handling.
- Partial data with missing optional fields.
- Required `fetchedAt` and `dataAsOf` fields.
- Sanitized public serialization.
- Feature flags defaulting off.
- No capability path reporting `canPlaceOrders=true`.
- No raw credentials in public connection summaries.
- Disconnect idempotency.
- User scoping.

Current test command:

```bash
npm run test:copilot
```

## Why Trading Is Excluded

`BrokerageReadProvider` intentionally excludes trading because SwingFi is research software, not a broker.

Keeping provider access read-only protects:

- Users from accidental order placement.
- SwingFi from unnecessary brokerage, custody, order-routing, and suitability complexity.
- The product from implying personalized financial advice.
- The architecture from mixing research evidence with execution instructions.

If SwingFi ever explores paper trading, it should be a separate `PaperExecutionProvider` abstraction with its own legal review, feature flags, and contract tests. Live trading should not be added to `BrokerageReadProvider`.

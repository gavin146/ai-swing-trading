# SwingFi Copilot Manual Portfolio Provider

Last updated: 2026-07-17

The Manual Portfolio Provider turns SwingFi's existing manually tracked `trade_history` records into a normalized read-only Copilot `PortfolioSnapshot`. It creates useful Copilot data before SwingFi chooses any external brokerage provider.

This provider does not connect to brokerage accounts, collect brokerage credentials, place orders, or change existing portfolio behavior.

## Implementation

Primary file:

- `lib/copilot/manual-portfolio-provider.ts`

Tests:

- `tests/copilot-manual-provider.test.ts`

Public contracts reused and extended:

- `lib/copilot/types.ts`

## Source Data

The provider reads active tracked trades from `trade_history`:

- `id`
- `user_id`
- `opportunity_id`
- `symbol`
- `asset_type`
- `entry_price`
- `target_price`
- `stop_loss`
- `quantity`
- `status`
- `opened_at`
- `notes`
- `created_at`

Only `open` and `planned` trades are included in the current snapshot. `closed` and `cancelled` trades remain in existing SwingFi history but are excluded from the active Copilot snapshot.

## Plan Preservation

The provider preserves the original tracked plan:

- entry price
- target price
- stop loss
- holding window parsed from notes
- original opportunity id when present
- plan creation timestamp
- plan source
- notes

It does not silently replace a user's saved target, stop, or holding window with a newer daily opportunity. If the same ticker appears in today's rankings later, a future analyzer can compare the old plan to the new one, but the provider snapshot remains faithful to the tracked trade.

## Quote And Valuation Data

The provider uses a dependency-injected `ManualPortfolioQuoteService`.

The included FMP implementation:

- batches by unique symbol before making quote lookups
- uses existing `getFmpCompanyProfile()` from `lib/providers/fmp.ts`
- returns quote metadata per symbol
- catches per-symbol failures and marks that ticker as degraded

Current price, market value, and unrealized gain/loss are included only when quote data is fresh and reliable.

If a quote is missing, stale, or fails:

- `currentPrice` is `null`
- `marketValue` is `null`
- `unrealizedGainLoss` is `null`
- `quote.status` explains `missing`, `stale`, or `error`
- the snapshot still succeeds with warnings

## Completeness Semantics

`PortfolioSnapshot.completeness.level` means:

- `empty`: no active tracked trades were returned
- `partial`: one or more tracked positions is missing quote, quantity, market value, or original plan context
- `complete`: every tracked position has quantity, entry price, fresh quote, market value, and original plan context

Unknown values are represented as `null`, never fabricated as zero.

Common missing fields:

- `quantity`
- `averageEntryPrice`
- `currentPrice`
- `marketValue`
- `costBasis`
- `freshQuote`
- `originalPlan.entryPrice`
- `originalPlan.targetPrice`
- `originalPlan.stopLoss`
- `originalPlan.holdingPeriodDays`

## What Manual Tracking Cannot Know

Without a brokerage connection, SwingFi cannot know:

- whether the user actually bought the ticker outside SwingFi
- exact broker fill price if the user entered the wrong time or price
- account cash balance
- full account value
- holdings not manually added to SwingFi
- tax lots
- dividends
- option positions
- margin, buying power, or unsettled funds
- whether the user sold or changed quantity outside SwingFi

Copilot reports should make this clear. Manual tracker data is useful, but it is not a complete brokerage account record.

## Duplicate Symbol Behavior

The provider supports multiple active tracked trades in the same symbol.

Example:

- `AMZN` trade from Monday
- `AMZN` trade from Thursday

Both become separate `PortfolioPosition` records because their `sourceTradeHistoryId` values differ. Quote lookup is still deduped so the quote service only receives `AMZN` once.

This matches the safest product assumption: the user may track multiple swing plans in the same ticker. If the UI later decides to force one active trade per symbol, that should be a separate product rule and database constraint.

## User Isolation

The provider requires a `userId` and calls `ManualPortfolioTradeRepository.listActiveTrackedTrades(userId)`.

The Supabase repository uses:

```sql
where user_id = :user_id
and status in ('open', 'planned')
```

The provider also defensively filters returned rows by `user_id`. If a repository ever returns another user's row, the provider ignores it and adds a warning.

## Future External Provider Coexistence

Manual tracker snapshots use:

- `providerId = manual_trade_history`
- `source = swingfi_tracker`
- no accounts array, because SwingFi manual tracking is not a brokerage account

Future external providers can return:

- real brokerage accounts
- full balances
- complete holdings
- provider `dataAsOf` timestamps
- provider-specific connection health

Both manual and external providers can feed the same future `PortfolioAnalyzer`, `DataFreshnessService`, and `CopilotReportBuilder` because they normalize into the same `PortfolioSnapshot` contract.

## User-Facing Distinction

Future UI should label manual data clearly:

- "Tracked in SwingFi"
- "Manual tracker"
- "Quote from FMP"
- "Not connected to brokerage"

External provider data should be labeled separately:

- "Connected account"
- provider/broker name
- account mask when available
- provider data timestamp

This prevents users from mistaking manually tracked plans for a complete brokerage account sync.

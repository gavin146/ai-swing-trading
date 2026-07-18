# Codex Handoff: Manual Portfolio Provider

Date: 2026-07-17

## Task

Build a provider-neutral ManualPortfolioReadProvider that turns SwingFi's existing manually tracked `trade_history` data into a normalized read-only Copilot `PortfolioSnapshot`.

## Files Changed

- `lib/copilot/types.ts`
- `lib/copilot/manual-portfolio-provider.ts`
- `lib/providers/fmp.ts`
- `tests/copilot-manual-provider.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`
- `docs/copilot/MANUAL_PORTFOLIO_PROVIDER.md`
- `docs/codex-handoffs/04-manual-portfolio-provider.md`

## Implementation Summary

- Added optional Copilot position metadata for original plan and quote freshness:
  - `PortfolioPositionPlan`
  - `PortfolioPositionQuote`
  - `costBasis`
  - `unrealizedGainLoss`
  - `originalPlan`
  - `quote`
- Added `swingfi_tracker` as a manual snapshot source.
- Added `ManualPortfolioReadProvider`.
- Added `ManualPortfolioTradeRepository` boundary.
- Added `ManualPortfolioQuoteService` boundary.
- Added `SupabaseManualPortfolioTradeRepository`.
- Added `FmpManualPortfolioQuoteService`.
- Added a defensive cross-user filter inside the provider even though the repository is expected to scope by `user_id`.
- Kept closed and cancelled trades out of the current snapshot.
- Preserved original tracked target, stop, entry, holding window, notes, and opportunity id.
- Deduped symbols before quote lookup while preserving duplicate active trades in the same ticker.
- Returned degraded snapshots for stale/missing/failed quotes instead of fabricating prices.

## Existing Behavior Not Changed

- No existing portfolio route behavior changed.
- No customer-facing brokerage controls were added.
- No brokerage SDK was installed.
- No brokerage account was connected.
- No live trading or order placement was added.
- No production migration was applied.
- No deployment was performed.

## Tests Added

`tests/copilot-manual-provider.test.ts` covers:

- no tracked trades
- one complete tracked trade
- missing quantity or cost basis
- missing current quote
- stale quote
- closed trade exclusion
- multiple symbols
- duplicate symbol behavior
- original plan preservation
- cross-user access prevention at the service boundary
- partial quote-provider failure returning a degraded snapshot

`package.json` now runs this file as part of `npm run test:copilot`.

## Notable Technical Decision

`lib/copilot/manual-portfolio-provider.ts` imports existing FMP provider code for the production quote service. That exposed a TypeScript issue in the isolated Copilot test compiler because Next.js supports `fetch(..., { next: { revalidate } })`, while plain TypeScript `RequestInit` does not. `lib/providers/fmp.ts` now casts that fetch init to `RequestInit & { next?: { revalidate?: number } }`, matching Next's runtime behavior without changing provider logic.

## Assumptions

- Current product allows multiple active tracked trades in the same symbol. The provider supports that and tests it.
- Manual tracker data is not a brokerage account, so snapshots return `accounts: []`.
- FMP profile price is treated as fresh when available because the current helper does not expose an exchange/provider quote timestamp.
- If SwingFi needs stricter intraday freshness later, add a dedicated quote endpoint that returns provider timestamps and wire it through `ManualPortfolioQuoteService`.

## Verification

- `npm run test:copilot`
  - Result: passed.
  - Output: `Copilot core contract tests passed.` and `Copilot manual portfolio provider tests passed.`
- `npm run typecheck`
  - Result: passed.
  - Output: `tsc --noEmit`.
- `npm run lint`
  - Result: passed.
  - Output: `eslint .`.
- `npm run verify`
  - Result: passed.
  - Output: `npm run lint && npm run typecheck && npm run build`.
  - Build result: Next.js 15.5.19 compiled successfully and generated 24 static pages.

## Recommended Next PR

Add a server-only Copilot analyzer that consumes `PortfolioSnapshot` from `ManualPortfolioReadProvider` and creates deterministic findings such as:

- near saved target
- near saved stop
- holding window almost complete
- quote stale or missing
- manual trade not in today's rankings
- newer SwingFi opportunity conflicts with the old plan

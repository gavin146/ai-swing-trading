# 09 - Paper Execution Core Handoff

## Task

Implemented the provider-neutral foundation for future autonomous paper trading. This is paper-only architecture and does not add a broker SDK, live trading, public UI, API routes, or deployment changes.

## Inspected Paths

- `/Users/gavin/Documents/ai swing trading/lib/copilot/types.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/config.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/time.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/validation.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/errors.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/portfolio-analyzer.ts`
- `/Users/gavin/Documents/ai swing trading/tests/copilot-core.test.ts`
- `/Users/gavin/Documents/ai swing trading/tests/tsconfig.copilot.json`
- `/Users/gavin/Documents/ai swing trading/package.json`
- `/Users/gavin/Documents/ai swing trading/docs/copilot/*`

No app-level `AGENTS.md` was present. The only `AGENTS.md` files found in this workspace were dependency-level Supabase files under `node_modules` and an unrelated sibling project.

## Files Changed

- `/Users/gavin/Documents/ai swing trading/lib/copilot/paper-execution.ts`
- `/Users/gavin/Documents/ai swing trading/tests/copilot-paper-execution.test.ts`
- `/Users/gavin/Documents/ai swing trading/tests/tsconfig.copilot.json`
- `/Users/gavin/Documents/ai swing trading/package.json`
- `/Users/gavin/Documents/ai swing trading/docs/copilot/PAPER_EXECUTION_ADAPTER_GUIDE.md`
- `/Users/gavin/Documents/ai swing trading/docs/codex-handoffs/09-paper-execution-core.md`

## Public Contracts Added

- `PaperExecutionProvider`
- `InMemoryPaperExecutionProvider`
- `PaperAccountState`
- `PaperPosition`
- `OrderIntent`
- `PaperOrder`
- `PaperFill`
- `PaperLedgerEvent`
- `RiskPolicyInput`
- `RiskPolicyDecision`
- `RiskPolicyEngine`
- `PaperExecutionResult`
- `PaperCancellationResult`
- `createOrderIntent`
- `createDefaultRiskPolicyConfig`
- `createPaperAccountState`

## Behavior Added

- Deterministic order-intent ids and idempotency keys.
- Paper-only execution mode guard.
- Feature flag guard with `paperTradingEnabled` defaulting off.
- Stale and missing quote rejection.
- Duplicate idempotency rejection.
- Unsupported asset and unsupported behavior rejection.
- Whole-share quantity validation.
- Stop/target and entry-range validation.
- Position, portfolio exposure, sector concentration, and max-open-position limits.
- Defensive-regime and earnings-blackout guards.
- In-memory accepted, filled, rejected, cancelled, and cancel-rejected event ledger.
- Deterministic simulated fills and position reconciliation.
- Explicit `llmOverrideAllowed: false` on all decisions.

## Tests Added

`/Users/gavin/Documents/ai swing trading/tests/copilot-paper-execution.test.ts` covers:

- feature flag off
- live-mode rejection
- stale quote
- duplicate order
- max order, position, and exposure rejection
- unsupported asset
- invalid stop and target
- entry outside plan
- defensive-regime gate
- earnings blackout
- deterministic fill and reconciliation
- cancellation
- no network calls
- LLM cannot bypass risk policy

## Commands Run

- `npm run test:copilot` - passed

Additional verification should run before merging:

- `npm run typecheck`
- `npm run lint`
- `npm run verify` if build time and current local app state allow it

## Assumptions

- Whole-share quantity is the only supported sizing mode for this foundation.
- Cash sufficiency is treated separately from configured risk caps for now and can be added when durable account persistence exists.
- The in-memory provider is for local/test simulation only and should not become a customer-facing state store.
- Future persistent paper execution tables should be additive and protected by RLS before UI exposure.

## Recommended Next PR

Add a Supabase-backed paper execution ledger behind `PAPER_TRADING_ENABLED=false`, with RLS, admin monitoring, and server-only APIs for internal simulation tests. Do not add customer UI controls until persistence, monitoring, and legal copy are complete.

## Explicitly Deferred

- Alpaca or other broker SDKs
- live execution
- live order endpoints
- public paper-trading UI
- customer-facing automation controls
- deposits, withdrawals, transfers, options, margin, shorting, leverage, or crypto execution

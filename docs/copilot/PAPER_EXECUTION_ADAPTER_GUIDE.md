# SwingFi Copilot Paper Execution Adapter Guide

SwingFi paper execution is a simulation boundary for future strategy testing. It is not live trading, does not connect to broker accounts, and does not place market orders with any external provider.

## Current Implementation

The provider-neutral core lives in:

- `/Users/gavin/Documents/ai swing trading/lib/copilot/paper-execution.ts`

It defines:

- `PaperExecutionProvider`
- `InMemoryPaperExecutionProvider`
- `PaperAccountState`
- `PaperPosition`
- `OrderIntent`
- `PaperOrder`
- `PaperFill`
- `RiskPolicyInput`
- `RiskPolicyDecision`
- `RiskPolicyEngine`

The in-memory provider is only for local simulation and tests. It makes no network calls, keeps an event ledger, supports cancellation for accepted unfilled simulated orders, rejects duplicate idempotency keys, and reconciles positions from deterministic fills.

## Paper-Only Rules

The current execution foundation intentionally excludes:

- live trading
- live broker endpoints
- live credentials
- deposits, withdrawals, or transfers
- options
- margin
- leverage
- short selling
- crypto execution
- account-password collection
- direct user-facing trade commands

Every future provider must keep paper and live environments physically and logically separate. SwingFi should not add a live execution provider without a separate legal, compliance, security, and product review.

## Order Intent Contract

An `OrderIntent` must exist before provider submission and must include:

- deterministic `id` and `idempotencyKey`
- strategy id and version
- originating SwingFi signal or opportunity reference
- symbol
- asset type
- side: `buy` or `sell`
- whole-share quantity
- order type: `market` or `limit`
- limit price when applicable
- source quote with `dataAsOf` and `fetchedAt`
- original target, stop, entry range, and holding plan
- explanation evidence
- creation timestamp
- execution mode, which must be `paper`

The current implementation supports whole-share quantity mode only. It does not support notional-only or fractional behavior.

## Risk Policy

`RiskPolicyEngine` is deterministic. It cannot call OpenAI, FMP, Supabase, a broker, or the network. It rejects unsafe intents before a provider can simulate them.

Default behavior is locked down:

- `paperTradingEnabled` defaults to `false`.
- Supported assets default to U.S. stock and ETF simulation only.
- Defensive-regime entries are blocked unless explicitly allowed.
- Earnings blackout, stale quote, exposure, position, and concentration limits are enabled through safe defaults.

No LLM may override a rejection. `RiskPolicyDecision.llmOverrideAllowed` is always `false`.

## Future Alpaca Paper Adapter Shape

A future Alpaca paper adapter could implement `PaperExecutionProvider` by translating an approved `OrderIntent` into Alpaca paper-account calls. That adapter must:

- use paper credentials only
- refuse live endpoint URLs
- run `RiskPolicyEngine` before every submission
- preserve the SwingFi `idempotencyKey`
- map provider order ids back into `PaperOrder`
- persist provider events into a durable ledger
- store provider timestamps separately from SwingFi timestamps
- reconcile fills into `PaperPosition`
- expose clear degraded states when Alpaca is unavailable
- redact credentials, tokens, account ids, and payloads from logs

The adapter must not add live order routes or live credential support.

## Idempotency

Every intent must carry an idempotency key derived from deterministic inputs or supplied by the caller. Providers must reject duplicate keys from:

- already submitted accepted orders
- filled orders
- rejected orders
- explicit idempotency sets supplied by a caller

This prevents double-submission when a retry or UI action repeats.

## Price Evidence

Every intent must include source quote evidence:

- `price`
- `source`
- `dataAsOf`
- `fetchedAt`
- `maxAgeSeconds`

Missing or stale quotes must reject the intent. A future adapter may not substitute a broker quote after risk approval unless it re-runs the risk policy with the newer quote.

## Event Ledger

Provider events should record:

- accepted simulated order
- rejected order
- fill
- cancellation
- cancellation rejection

For production-grade paper execution, this ledger should move from memory into Supabase with RLS and server-only authorization before any customer-facing paper feature is enabled.

## Required Provider Contract Tests

Every future paper provider must pass tests equivalent to:

- feature flag off rejects
- live mode rejects
- stale or missing quote rejects
- duplicate order rejects
- max order, position, portfolio exposure, and sector concentration reject
- unsupported asset rejects
- invalid stop and target reject
- defensive-regime gate rejects
- earnings blackout rejects
- deterministic fill and reconciliation
- cancellation behavior
- no network calls in unit tests
- LLM override cannot bypass risk policy

## Rollout Requirements

Before any user-facing paper execution controls are added:

- persistence schema must be added and reviewed
- admin monitoring must show paper events and failures
- customer copy must clearly say simulation
- legal language must clarify that paper fills do not equal real execution
- feature flags must default off in production
- security review must verify no live credentials or live endpoints are present

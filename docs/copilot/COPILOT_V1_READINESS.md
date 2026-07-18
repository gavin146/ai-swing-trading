# SwingFi Copilot V1 Readiness

Last updated: 2026-07-18

## Scope

SwingFi Copilot V1 is a feature-flagged, research-only portfolio review layer. It uses the existing SwingFi manual trade tracker as the first provider and turns user-owned tracked trades into normalized portfolio snapshots, deterministic findings, reports, UI view models, and admin-only email previews.

This readiness state does not include brokerage connections, live trading, public paper-trading controls, automatic Copilot emails, or production database migration application.

## Completed Capabilities

- Canonical Copilot contract module: `/Users/gavin/Documents/ai swing trading/lib/copilot/types.ts`.
- Read-only provider registry and provider capability contracts.
- Manual provider: `/Users/gavin/Documents/ai swing trading/lib/copilot/manual-portfolio-provider.ts`.
- Manual provider reads authenticated user tracked trades through `trade_history` and preserves the original entry, target, stop, plan source, and holding window.
- Manual provider represents unknown quantity, cost basis, market value, current quote, and account values as `null` instead of zero.
- Manual provider filters cross-user rows at the service boundary even if the repository returns unexpected data.
- Data freshness service: `/Users/gavin/Documents/ai swing trading/lib/copilot/data-freshness.ts`.
- Deterministic portfolio analyzer: `/Users/gavin/Documents/ai swing trading/lib/copilot/portfolio-analyzer.ts`.
- Analyzer findings use canonical severities: `info`, `attention`, `high`.
- Analyzer findings use canonical types such as `DATA_STALE`, `QUOTE_UNAVAILABLE`, `NEAR_STOP`, `NEAR_TARGET`, `HOLDING_WINDOW_EXPIRED`, and `INSIDE_ORIGINAL_PLAN`.
- Deterministic report builder and rule-based narrator: `/Users/gavin/Documents/ai swing trading/lib/copilot/reporting.ts`.
- Optional OpenAI narrator adapter: `/Users/gavin/Documents/ai swing trading/lib/copilot/openai-narrator.ts`.
- OpenAI narrator is server-only, feature-flagged off by default, validates output, and falls back to the rule-based narrator.
- Feature-flagged `/copilot` page: `/Users/gavin/Documents/ai swing trading/app/copilot/page.tsx`.
- Authenticated Copilot report API: `/Users/gavin/Documents/ai swing trading/app/api/copilot/report/route.ts`.
- Admin-only Copilot email preview: `/Users/gavin/Documents/ai swing trading/app/api/admin/copilot/email-preview/route.ts`.
- Copilot daily digest email renderer: `/Users/gavin/Documents/ai swing trading/lib/copilot/email.ts`.
- Paper-execution domain remains isolated in `/Users/gavin/Documents/ai swing trading/lib/copilot/paper-execution.ts` with no customer UI or public route.
- Additive Copilot SQL migration and rollback files exist under `/Users/gavin/Documents/ai swing trading/db/`.
- Copilot migration enums have been reconciled with the current deterministic analyzer contract.
- End-to-end deterministic manual slice test added: `/Users/gavin/Documents/ai swing trading/tests/copilot-manual-slice.test.ts`.

## Disabled Or Unimplemented Capabilities

- `COPILOT_ENABLED` defaults to `false`.
- `BROKERAGE_CONNECTIONS_ENABLED` defaults to `false`.
- `PAPER_TRADING_ENABLED` defaults to `false`.
- `COPILOT_AI_NARRATION_ENABLED` defaults to `false`.
- `/copilot` returns not found unless `COPILOT_ENABLED=true`.
- Brokerage connections are placeholder-only.
- No SnapTrade, Plaid, Alpaca, or other brokerage SDK is installed.
- No live trading route exists.
- No order-placement route exists.
- No automatic Copilot email or cron is enabled.
- No persistent Copilot snapshot/report repository is wired into the runtime yet.
- No production Copilot migration has been applied by this work.

## Security And RLS Status

- Customer Copilot report route derives identity with `resolveCustomerSession(request)`.
- Customer Copilot report route does not accept a client-supplied `user_id`.
- Admin Copilot email preview checks `isAdminApiRequest(request)`.
- Admin Copilot email preview renders fixture data and returns `sent: false`.
- Service-role credentials are not used in Copilot client components.
- OpenAI narrator and manual provider assert server-only usage.
- Browser-safe public models omit server credential references.
- Optional provider IDs exist only as neutral future identifiers.
- SQL migration enables RLS for user-owned Copilot tables:
  - `brokerage_connections`
  - `brokerage_accounts`
  - `portfolio_sync_runs`
  - `portfolio_snapshots`
  - `portfolio_positions`
  - `copilot_findings`
  - `copilot_reports`
- SQL migration uses composite `(id, user_id)` foreign keys to prevent cross-user child-row linkage.
- Local SQL RLS verification file exists: `/Users/gavin/Documents/ai swing trading/db/copilot-rls-verification.sql`.
- RLS verification was not executed in this environment because `psql` is not installed.

## Test Results

Latest completed during Prompt 11:

- `npm run test:copilot` - passed.
- `npm run test:security` - passed.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `npm run verify` - passed.

Local SQL verification:

- `psql --version` failed with `zsh:1: command not found: psql`.
- Because `psql` is unavailable, `/Users/gavin/Documents/ai swing trading/db/copilot-rls-verification.sql` was inspected but not executed.

## Required Environment Variables And Safe Defaults

- `COPILOT_ENABLED=false`
  - Server-side gate for `/copilot` and `/api/copilot/report`.
- `NEXT_PUBLIC_COPILOT_ENABLED=false`
  - Optional navigation visibility only. This must not be treated as an authorization boundary.
- `BROKERAGE_CONNECTIONS_ENABLED=false`
  - Future external provider gate.
- `PAPER_TRADING_ENABLED=false`
  - Future simulation gate. Current paper module is not reachable from customer UI or public API.
- `COPILOT_AI_NARRATION_ENABLED=false`
  - Optional OpenAI narration gate. Rule-based narration remains the production fallback.
- `COPILOT_FIXTURE_MODE=false`
  - Local non-production demo mode only.
- Existing Supabase, FMP, OpenAI, Resend, admin, and app URL variables remain governed by existing production readiness checks.

## Known Limitations

- Manual tracked trades are not the same as connected brokerage holdings.
- Manual data cannot confirm trades held outside SwingFi unless the user adds them.
- Quantity, cost basis, cash, account value, and market value stay unknown when current records do not provide enough information.
- Current quote lookup uses the existing FMP company profile path through the manual provider route; it is not a streaming quote feed.
- Copilot reports are generated on request and are not persisted yet.
- Admin email preview uses deterministic fixture data and does not send.
- No automated Copilot digest cron exists.
- OpenAI narration is optional and can only rewrite supplied evidence. It cannot calculate values or invent trade facts.
- The UI is hidden behind flags, so full user QA requires enabling flags in staging or local development.
- SQL migration has not been applied to production and was not locally executed in this environment.

## Manual QA Checklist

Owner-only local or staging preview:

- Set `COPILOT_ENABLED=true`.
- Set `NEXT_PUBLIC_COPILOT_ENABLED=true` if the Copilot nav item should appear.
- Keep `BROKERAGE_CONNECTIONS_ENABLED=false`.
- Keep `PAPER_TRADING_ENABLED=false`.
- Keep `COPILOT_AI_NARRATION_ENABLED=false` for deterministic first QA.
- Log in as a normal customer.
- Add one open tracked trade with complete entry, target, stop, quantity, and holding-window notes.
- Add one open tracked trade with missing quantity.
- Add one closed tracked trade and confirm it does not appear in Copilot.
- Visit `/copilot`.
- Confirm only the logged-in user's manual trades appear.
- Confirm source and data-as-of labels appear.
- Confirm stale or missing quotes show a degraded state instead of fabricated values.
- Confirm findings use review-oriented language.
- Confirm no button asks for brokerage credentials.
- Confirm no buy/sell command appears.
- Confirm mobile layout does not require horizontal scrolling.
- Visit `/api/admin/copilot/email-preview` as admin and confirm it renders fixture preview only.
- Visit `/api/admin/copilot/email-preview?format=html` and inspect email colors in light and dark email clients.

## Rollback Plan

- Disable `COPILOT_ENABLED`.
- Disable `NEXT_PUBLIC_COPILOT_ENABLED`.
- Disable `COPILOT_AI_NARRATION_ENABLED`.
- Disable `BROKERAGE_CONNECTIONS_ENABLED`.
- Disable `PAPER_TRADING_ENABLED`.
- Revert this commit if code rollback is required.
- If the optional SQL migration was applied in a local or staging database, run `/Users/gavin/Documents/ai swing trading/db/copilot-schema-rollback.sql`.
- Do not run the rollback SQL against production without a normal database backup and change review.

## Remaining Tasks Before Owner-Only Preview

- Run final verification commands for this commit.
- Install local `psql` or use Supabase SQL editor against a local/staging database to run:
  - `/Users/gavin/Documents/ai swing trading/db/copilot-schema-migration.sql`
  - `/Users/gavin/Documents/ai swing trading/db/copilot-rls-verification.sql`
- Enable `COPILOT_ENABLED=true` in local/staging only.
- Manually QA `/copilot` with real SwingFi tracked trades.
- Manually QA admin email preview.
- Confirm admin access works for the preview route.
- Confirm quote failures do not block the whole Copilot page.
- Decide whether owner preview should persist generated Copilot reports or stay on-request only.

## Remaining Tasks Before Five-User Beta

- Apply the Copilot migration to a staging Supabase project and run RLS verification there.
- Add a Supabase-backed repository for Copilot snapshots, findings, and reports.
- Add operational logs for Copilot report generation, quote freshness, narrator fallback, and sanitized errors.
- Add admin visibility for Copilot health and report generation status.
- Add rate limiting for Copilot report generation if usage grows.
- Decide whether to enable rule-based only narration or OpenAI-assisted narration for beta.
- If OpenAI narration is enabled, track per-user cost metadata without storing raw portfolio payloads.
- Add customer-facing product copy explaining manual tracker limitations.
- Add legal review for portfolio-personalized research language before multi-user beta.
- Add support and incident response steps for stale quotes, missing plans, and report failures.
- Run mobile and desktop QA on `/copilot`, `/portfolio`, `/dashboard`, and admin preview.

## Explicit Blockers

Brokerage provider selection is required before:

- Connecting external brokerage accounts.
- Reading brokerage holdings, cash, balances, or transactions.
- Showing provider connection health for real accounts.
- Building real disconnect/delete-provider workflows.

Commercial data rights are required before:

- Marketing Copilot as using live, comprehensive, or institutional-grade account and market data.
- Expanding quote/news/filing usage beyond the current plan's allowed terms.
- Sending broad customer emails that depend on provider data with redistribution limits.

Legal and compliance review is required before:

- Charging for portfolio-personalized Copilot output.
- Using stronger recommendation language.
- Enabling any broker-connected experience.
- Enabling paper-trading UI for customers.
- Adding broker handoff flows that could be interpreted as order solicitation.
- Any future live trading, margin, shorting, crypto execution, options, transfer, or withdrawal capability.

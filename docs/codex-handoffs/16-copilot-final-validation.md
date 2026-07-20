# Copilot Final Validation And CI

Date: 2026-07-19
Branch: `codex/copilot-stabilization`
PR: `#1`

## Scope

Completed repair prompt 15 from `repairprompts#3.md`.

This is a superseding final validation handoff for the owner-preview SwingFi Copilot branch. It does not mark the PR ready, merge it, deploy it, apply migrations, connect brokerage accounts, or enable Copilot flags.

## Actual Architecture In This Branch

- `/copilot` is a logged-in, feature-flagged owner-preview page.
- `/api/copilot/report` builds a manual Copilot report from existing SwingFi tracked trades only after:
  - `COPILOT_ENABLED=true`;
  - authenticated Supabase session resolution;
  - owner preview email allowlist check from `COPILOT_PREVIEW_EMAILS`, defaulting to `gavin@onefear.co`.
- `ManualPortfolioReadProvider` normalizes existing `trade_history` rows into read-only `PortfolioSnapshot` data.
- `PortfolioAnalyzer` produces deterministic findings without OpenAI, FMP, Supabase, or network calls.
- `DataFreshnessService` aggregates source health deterministically using the worst source state.
- `CopilotReportBuilder` and `RuleBasedCopilotNarrator` produce deterministic report output.
- `OpenAICopilotNarrator` exists as an optional server-only adapter and remains off by default.
- Admin Copilot email preview renders fixture data only and does not send email.
- Paper execution code is isolated, in-memory, test/local only, and has no public UI or order route.

## Final Validation Changes

- Added `npm run verify:copilot`.
- Changed `npm run verify` to run `npm run verify:copilot`.
- Added `.github/workflows/copilot-preview.yml`.
- CI uses Node.js 20, `npm ci`, and `npm run verify:copilot`.
- CI sets all Copilot/brokerage/paper/AI fixture flags to `false`.

## Feature Flag Defaults Confirmed

- `COPILOT_ENABLED=false`
- `BROKERAGE_CONNECTIONS_ENABLED=false`
- `PAPER_TRADING_ENABLED=false`
- `COPILOT_AI_NARRATION_ENABLED=false`
- `COPILOT_FIXTURE_MODE=false`

`NEXT_PUBLIC_COPILOT_ENABLED` may reveal local navigation only. It does not authorize the API.

## Owner-Only Authorization

- `app/api/copilot/report/route.ts` checks `isCopilotPreviewEmailAllowed(session.user?.email)` before creating `ManualPortfolioReadProvider`, `FmpManualPortfolioQuoteService`, `SupabaseManualPortfolioTradeRepository`, or loading latest opportunities.
- Unauthorized users receive a generic unavailable response.
- Copilot API responses include `Cache-Control: private, no-store`.
- Raw provider/database/FMP errors are logged server-side with redaction and are not returned to the browser.

## Migration And RLS Status

- `db/copilot-schema-migration.sql` is transactional.
- `db/copilot-schema-rollback.sql` is transactional.
- `scripts/validate-copilot-sql.mjs` statically checks transaction boundaries, composite FK unique targets, rollback coverage, and fail-closed RLS verification.
- `db/copilot-rls-verification.sql` records table-by-table isolation checks and raises an exception if any recorded check fails.
- Local database execution was not performed because `psql`, Supabase CLI, and Docker database tooling are unavailable in this environment.
- No production or shared Supabase database was touched.

## Data Accuracy Status

- Missing monetary values render as `Unknown` / `unknown`, never `$0.00`.
- Stale or missing quotes cannot generate target, stop, inside-plan, near-target, near-stop, or reward/risk conclusions.
- FMP profile prices without provider-supplied market timestamps are marked stale and keep `fetchedAt` separate from `dataAsOf`.
- Invalid long-only plans produce incomplete-plan findings and cannot generate price-plan conclusions.
- Same-symbol evidence matching is scope-aware and cannot leak trade-specific evidence to another position.

## Safety Scans

Searches performed:

- Feature flags and public env usage.
- External brokerage SDK/provider references.
- Live-order, withdrawal, deposit, transfer, margin, options, leverage, and short-sale terms.
- Client-supplied `user_id` patterns.
- Public env variables used for authorization.
- Raw secret logging patterns.
- Direct “buy now,” “sell now,” guaranteed-return, and risk-free language.

Results:

- No external brokerage SDK dependency was added.
- SnapTrade/Plaid appear only as provider-neutral future identifiers and documentation.
- No live trading/order route was added.
- Paper execution remains isolated from customer UI/API.
- Direct-advice phrase matches are safety tests/documentation/prompt constraints, not enabled customer copy.
- No client-supplied `user_id` authorization path was found in Copilot routes.
- No public env variable authorizes Copilot API access.

## Commands Run

- `npm ci`
  - Passed.
  - Reported `2 moderate severity vulnerabilities`.
  - Did not run `npm audit fix --force`.
- `npm run lint`
  - Passed.
- `npm run typecheck`
  - Passed.
- `npm run test:copilot`
  - Passed.
  - Includes static SQL validation and all Copilot deterministic tests.
- `npm run test:security`
  - Passed.
- `npm run build`
  - Passed.
- `npm run verify:copilot`
  - Passed.
- `git diff --check`
  - Passed with no output.

## Known Limitations

- Copilot is not beta-ready until the SQL migration and RLS verification run successfully against a disposable local/staging Supabase database.
- Copilot persistence tables are not applied to production.
- No external brokerage provider has been selected.
- No brokerage connection flow exists.
- No live or paper trading UI/API exists.
- OpenAI narration remains optional and off by default.
- CI has been added but should be allowed to run on GitHub after push before human approval.

## Explicit No-Go Statement

This PR does not add brokerage connectivity, SnapTrade, Plaid, Alpaca, live trading, withdrawals, deposits, transfers, margin, options, leverage, short-selling, crypto execution, or order placement.

## Recommended Human Review

1. Confirm CI passes on GitHub after this branch is pushed.
2. Apply migration, RLS verification, rollback, and reapply only in a disposable local/staging database.
3. Review `/api/copilot/report` authorization ordering.
4. Review `tests/copilot-data-accuracy.test.ts` for the missing-value and stale-data regressions.
5. Keep PR #1 as draft until database execution evidence is captured.

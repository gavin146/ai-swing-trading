# Handoff 07: Copilot UI

## Summary

Implemented a feature-flagged SwingFi Copilot UI at `/copilot` using current/manual SwingFi tracked-portfolio data when authenticated, plus safe deterministic fixture support for local preview.

## Files Changed

- `app/copilot/page.tsx`
- `app/api/copilot/report/route.ts`
- `components/CopilotPanel.tsx`
- `components/AppShell.tsx`
- `lib/copilot/ui-view-model.ts`
- `tests/copilot-ui-view-model.test.ts`
- `tests/tsconfig.copilot.json`
- `package.json`
- `eslint.config.mjs`
- `docs/copilot/COPILOT_UI_STATES.md`
- `docs/codex-handoffs/07-copilot-ui.md`

## Inspected Paths

- `app/dashboard/page.tsx`
- `app/portfolio/page.tsx`
- `app/login/page.tsx`
- `app/not-found.tsx`
- `components/AppShell.tsx`
- `components/SwingPortfolioPanel.tsx`
- `components/LoginForm.tsx`
- `components/ToastNotice.tsx`
- `components/PageSkeleton.tsx`
- `components/SummaryTile.tsx`
- `components/MetricPill.tsx`
- `components/ScoreMeter.tsx`
- `lib/auth/customer-session.ts`
- `lib/auth/research-access.ts`
- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `lib/copilot/config.ts`
- `lib/copilot/manual-portfolio-provider.ts`
- `lib/copilot/portfolio-analyzer.ts`
- `lib/copilot/reporting.ts`
- `lib/repositories/opportunities.ts`
- `app/api/portfolio/route.ts`
- `app/api/daily-picks/route.ts`

No repository-level `AGENTS.md` file was present. Only dependency-level `AGENTS.md` files were found under `node_modules`.

## Behavior Added

- `/copilot` route is hidden by server feature flag unless `COPILOT_ENABLED=true`.
- AppShell supports `active="copilot"`.
- Optional nav display via `NEXT_PUBLIC_COPILOT_ENABLED=true`.
- `/api/copilot/report` requires a bearer auth token for live/manual data.
- The API never accepts `user_id` from client input.
- The API uses:
  - `ManualPortfolioReadProvider`
  - `SupabaseManualPortfolioTradeRepository`
  - `FmpManualPortfolioQuoteService`
  - `PortfolioAnalyzer`
  - `CopilotReportBuilder`
  - `RuleBasedCopilotNarrator`
- Local fixture mode can be enabled with `COPILOT_FIXTURE_MODE=true` outside production.
- UI includes loading, sign-in, empty, error, fixture, degraded-data, and ready states.
- Brokerage connection placeholder is disabled and explicitly says no provider has been selected.

## Tests Added

- Empty state
- Complete manual portfolio fixture
- Stale-data state
- High-severity finding display
- Fixture labeling
- Feature flag default off
- No banned direct-advice language in Copilot UI files

## Commands Run

```bash
npm run test:copilot
npm run typecheck
npm run lint
npm run verify
```

## Assumptions

- Current user auth remains browser-session based; the protected data API performs the server authorization check.
- Supabase service-role use stays server-only.
- `NEXT_PUBLIC_COPILOT_ENABLED` may be set alongside `COPILOT_ENABLED` when the feature should appear in navigation.
- Fixture mode is for local preview only and should not be enabled in production.

## Recommended Next PR

Add a first customer-facing Copilot preview experiment:

1. Enable `COPILOT_ENABLED=true` and `NEXT_PUBLIC_COPILOT_ENABLED=true` in a staging environment only.
2. Test with one account containing open SwingFi tracked trades.
3. Add admin telemetry for Copilot report loads, stale-data rates, and empty-state frequency.
4. Only then decide whether to add Copilot summary blocks into portfolio emails.

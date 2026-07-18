# Codex Handoff: Copilot Audit

Date: 2026-07-17

## Task

Create documentation-only audit and implementation map for future SwingFi Copilot.

## Files Created

- `docs/copilot/COPILOT_REPOSITORY_AUDIT.md`
- `docs/copilot/COPILOT_IMPLEMENTATION_MAP.md`
- `docs/codex-handoffs/01-copilot-audit.md`

## Production Behavior

- No production application behavior was modified.
- No dependencies were added.
- No brokerage SDK was added.
- No live-trading or paper-trading code was added.
- No database migrations were applied.
- No deployment was performed.

## Inspected Paths

Instructions and project structure:

- `package.json`
- `next.config.ts`
- `vercel.json`
- `.env.example`
- `app/**`
- `components/**`
- `lib/**`
- `db/**`
- `docs/**`
- `scripts/**`

Database and types:

- `db/schema.sql`
- `db/auth-email-verification.sql`
- `db/prediction-outcomes-migration.sql`
- `db/preferred-brokerage-migration.sql`
- `lib/database.types.ts`

Auth/security:

- `lib/supabase/server.ts`
- `lib/supabase/browser.ts`
- `lib/auth/admin.ts`
- `lib/auth/customer-session.ts`
- `lib/auth/research-access.ts`
- `lib/auth/email-verification.ts`
- `app/api/auth/signup/route.ts`
- `app/api/auth/password-reset/route.ts`
- `app/api/auth/resend-verification/route.ts`
- `app/api/customers/session/route.ts`
- `app/api/customers/sync/route.ts`

Portfolio and manual trade tracking:

- `app/portfolio/page.tsx`
- `app/api/portfolio/route.ts`
- `app/api/portfolio/[id]/route.ts`
- `app/api/portfolio/entry-price/route.ts`
- `app/api/portfolio/exit-plan/route.ts`
- `app/api/portfolio/coach/route.ts`
- `app/api/portfolio/symbol-search/route.ts`
- `components/SwingPortfolioPanel.tsx`
- `lib/portfolio/exit-plan.ts`
- `lib/portfolio/intelligence.ts`
- `lib/portfolio/morning-digest.ts`
- `lib/brokerages.ts`
- `components/BrokerageLaunchPanel.tsx`

Opportunities, ranking, market data, and prediction tracking:

- `lib/repositories/opportunities.ts`
- `lib/opportunities.ts`
- `lib/agent/index.ts`
- `lib/agent/types.ts`
- `lib/agent/ranking-agent.ts`
- `lib/agent/fmp-equity-universe.ts`
- `lib/agent/calibration.ts`
- `lib/agent/persisted-calibration.ts`
- `lib/backtesting.ts`
- `lib/prediction-tracking.ts`
- `lib/market-intelligence.ts`
- `lib/providers/fmp.ts`
- `lib/providers/sec-edgar.ts`
- `lib/providers/fred.ts`
- `lib/providers/bls.ts`
- `lib/providers/treasury.ts`

OpenAI and explanations:

- `lib/openai.ts`
- `app/api/assistant/chat/route.ts`
- `app/api/agent/explain/route.ts`
- `app/api/insights/opportunities/route.ts`
- `app/api/insights/portfolio/route.ts`

Email, SMS, tracking, cron, and admin:

- `lib/alerts.ts`
- `lib/email.ts`
- `lib/email-branding.ts`
- `lib/twilio.ts`
- `app/e/[trackingId]/page.tsx`
- `app/api/track/open/[trackingId]/route.ts`
- `app/api/cron/daily-rankings/route.ts`
- `app/api/cron/morning-alerts/route.ts`
- `app/api/cron/prediction-evaluation/route.ts`
- `app/api/admin/status/route.ts`
- `app/api/admin/cron-status/route.ts`
- `app/api/admin/activity/route.ts`
- `app/api/admin/access/route.ts`
- `app/api/admin/customers/route.ts`
- `app/api/admin/communications/test/route.ts`
- `components/AdminWorkspace.tsx`
- `components/AdminCommandCenter.tsx`
- `components/AdminAccessPanel.tsx`
- `components/AdminCustomerPanel.tsx`
- `components/AdminCommunicationsPanel.tsx`
- `components/AdminCronMonitor.tsx`

Billing:

- `lib/stripe/config.ts`
- `lib/stripe/server.ts`
- `lib/stripe/subscription-sync.ts`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/portal/route.ts`
- `app/api/stripe/webhook/route.ts`

Testing and verification:

- `scripts/verify-production-env.mjs`
- `scripts/verify-production-surface.mjs`
- `scripts/verify-stripe-readiness.mjs`
- `scripts/setup-stripe-products.mjs`

## Major Findings

- The existing manual portfolio system based on `trade_history` is the best low-risk foundation for Copilot.
- The repository already has useful deterministic services: `buildPortfolioExitPlan`, `getTradeLiveIntelligence`, `getMorningPortfolioDigest`, `listLatestOpportunities`, and prediction/backtest summaries.
- The repo has provider-style modules for FMP, FRED, BLS, Treasury, and SEC, but no brokerage read provider interface yet.
- There is no existing external brokerage integration, provider-token vault, order-intent ledger, paper-execution abstraction, or Copilot report table.
- New Copilot functionality should default off behind feature flags.
- All future brokerage/provider records need `fetched_at` and `data_as_of`.
- AI narration should sit after deterministic analysis and must not calculate or invent numbers.
- Service-role Supabase access is common in API routes, so new Copilot APIs need explicit user scoping and authorization tests.

## Major Risks

- Service-role routes can bypass RLS; every user-owned Copilot query must include explicit `user_id` scoping.
- Admin API token localStorage should not be reused for provider credentials.
- Legacy localStorage customer/mock helpers exist and must not be part of Copilot.
- Prompt logic is currently inline; Copilot should centralize narrator prompts.
- No AI usage ledger exists yet.
- No external provider legal/compliance decision exists.
- No test runner beyond lint/typecheck/build is configured.

## Recommended First Implementation PR

Start with a foundation-only PR:

1. Add Copilot feature flags to `.env.example`.
2. Add `lib/copilot/types.ts`.
3. Add `lib/copilot/providers/BrokerageReadProvider.ts`.
4. Add `lib/copilot/providers/manual-trade-history-provider.ts`.
5. Add `lib/copilot/providers/provider-registry.ts`.
6. Keep UI and routes off for this first PR.

This gives SwingFi a provider-neutral Copilot foundation while avoiding brokerage, trading, migration, and compliance risk.

## Verification Commands

- `npm run typecheck`
  - Result: passed.
  - Command output: `tsc --noEmit`.
- `npm run lint`
  - Result: passed.
  - Command output: `eslint .`.
- `npm run verify`
  - Result: passed.
  - Command output: `npm run lint && npm run typecheck && npm run build`.
  - Build result: Next.js 15.5.19 compiled successfully, generated 24 static pages, and listed all dynamic API/app routes.

## Commit Scope

Only these documentation files should be committed:

- `docs/copilot/COPILOT_REPOSITORY_AUDIT.md`
- `docs/copilot/COPILOT_IMPLEMENTATION_MAP.md`
- `docs/codex-handoffs/01-copilot-audit.md`

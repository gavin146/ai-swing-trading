# SwingFi Copilot Repository Audit

Last audited: 2026-07-17

This audit covers the existing SwingFi repository for a future read-only product area called SwingFi Copilot. No production behavior, dependencies, migrations, deployments, brokerage SDKs, paper-trading code, or live-trading code were changed as part of this audit.

## AGENTS Instructions

- No project-level `AGENTS.md` exists under `/Users/gavin/Documents/ai swing trading`.
- `find .. -name AGENTS.md -print` found only unrelated or dependency instructions:
  - `../ai coach/nextjs-boilerplate-main/AGENTS.md`
  - `node_modules/**/AGENTS.md` under Supabase packages.
- No dependency `AGENTS.md` was treated as applicable to this repository audit.

## Application Architecture

SwingFi is a Next.js App Router application using TypeScript, Tailwind CSS, Supabase, FMP, FRED, BLS, Treasury Fiscal Data, SEC EDGAR fallback, OpenAI, Resend, Twilio, and Stripe.

Core configuration:

- `package.json`
  - Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `verify`, `production:env`, `production:surface`, `stripe:setup`, `stripe:verify`.
  - Runtime dependencies: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `stripe`.
- `next.config.ts`
  - Sets security headers.
  - Marks `/api/*`, `/admin`, `/agent`, `/backtests`, `/dashboard`, `/portfolio`, `/opportunities/*`, and auth/account pages as `noindex`.
  - Redirects `/agent` to `/admin`, `/backtests` to `/admin?tab=backtesting`, and `/themes` to `/dashboard`.
- `vercel.json`
  - `0 13 * * 1-5` for `/api/cron/daily-rankings`.
  - `20 13 * * 1-5` for `/api/cron/morning-alerts`.
  - `15 22 * * 1-5` for `/api/cron/prediction-evaluation`.
- `app/layout.tsx`
  - Defines metadata, Google verification, analytics, footer risk language, and global app wrapper.
- `app/globals.css`
  - Tailwind/global styling and app theme.

## Relevant Routes

Customer-facing pages:

- `app/page.tsx`: public landing page.
- `app/pricing/page.tsx`: pricing page.
- `app/signup/page.tsx`: account creation flow.
- `app/login/page.tsx`: login and password reset entry.
- `app/reset-password/page.tsx`: reset password page.
- `app/verify-email/page.tsx`: email verification page.
- `app/dashboard/page.tsx`: authenticated customer research dashboard using `DashboardOpportunities`.
- `app/opportunities/[symbol]/page.tsx`: authenticated opportunity detail using `OpportunityDetailView`.
- `app/portfolio/page.tsx`: authenticated manual tracked-trade portfolio using `SwingPortfolioPanel`.
- `app/history/page.tsx`: pick history.
- `app/settings/page.tsx`: account/settings preferences.
- `app/unsubscribe/page.tsx`: email unsubscribe.
- `app/legal/**`: legal, disclaimer, privacy, and terms.

Admin pages:

- `app/admin/page.tsx`: admin workspace using `AdminWorkspace`.
- `/agent`, `/backtests`, and `/themes` redirect away in `next.config.ts`.

Customer APIs relevant to Copilot:

- `app/api/opportunities/route.ts`: returns latest opportunities after `resolveResearchAccess`.
- `app/api/opportunities/[symbol]/route.ts`: returns one opportunity after `resolveResearchAccess`.
- `app/api/daily-picks/route.ts`: returns user-specific saved daily picks after `resolveCustomerSession`.
- `app/api/portfolio/route.ts`: lists and creates user-owned `trade_history` rows after `resolveCustomerSession`.
- `app/api/portfolio/[id]/route.ts`: updates/deletes scoped user-owned trades.
- `app/api/portfolio/entry-price/route.ts`: estimates entry price from FMP intraday candles.
- `app/api/portfolio/exit-plan/route.ts`: builds an exit plan.
- `app/api/portfolio/coach/route.ts`: portfolio coaching endpoint.
- `app/api/portfolio/symbol-search/route.ts`: authenticated FMP ticker/name search.
- `app/api/insights/opportunities/route.ts`: OpenAI/deterministic plain-language opportunity insights.
- `app/api/insights/portfolio/route.ts`: OpenAI/deterministic portfolio insights.
- `app/api/assistant/chat/route.ts`: Ask SwingFi chat with research access, user context, portfolio, ticker evidence, and OpenAI fallback.

Agent, cron, and admin APIs relevant to Copilot:

- `app/api/cron/daily-rankings/route.ts`: protected daily ranking cron.
- `app/api/cron/morning-alerts/route.ts`: protected morning email/SMS alert cron.
- `app/api/cron/prediction-evaluation/route.ts`: protected forward-outcome evaluation cron.
- `app/api/agent/daily-rankings/route.ts`: admin-protected manual agent run.
- `app/api/admin/run-agent/route.ts`: admin-protected manual persisted agent run.
- `app/api/admin/predictions/route.ts`: admin prediction accuracy summary/evaluation.
- `app/api/backtests/rolling/route.ts`: admin rolling backtest run.
- `app/api/admin/status/route.ts`: admin production readiness/status.
- `app/api/admin/cron-status/route.ts`: latest cron, email, and prediction monitor.
- `app/api/admin/activity/route.ts`: unified admin activity feed.
- `app/api/admin/customers/route.ts`: customer and engagement reporting.
- `app/api/admin/access/route.ts`: admin grant management.
- `app/api/admin/communications/test/route.ts`: safe email/SMS test sends.

## Server And Client Boundaries

Server-only or server API layers:

- `lib/supabase/server.ts`
  - `createSupabaseAdminClient()`
  - `hasSupabaseAdminConfig()`
  - `hasSupabasePublicConfig()`
  - Reads service-role style keys only from server env.
- `lib/auth/customer-session.ts`
  - `resolveCustomerSession(request)`
  - Verifies Supabase access token with admin client.
  - Resolves or creates SwingFi `users` row.
- `lib/auth/research-access.ts`
  - `resolveResearchAccess(request)`
  - Gates research by admin role, verified email, active trial, or active subscription.
- `lib/auth/admin.ts`
  - `isAdminApiRequest(request)`
  - Allows local trusted header in development.
  - In production accepts `ADMIN_API_SECRET` bearer or verified approved Supabase admin.
- `lib/providers/*`
  - FMP/FRED/BLS/Treasury/SEC provider calls are server-side utilities.
- `lib/openai.ts`
  - Server-side Chat Completions wrapper.
- `lib/email.ts`, `lib/twilio.ts`, `lib/stripe/*`
  - Provider secrets are read server-side.

Client components and browser state:

- `lib/supabase/browser.ts`
  - Creates browser Supabase client from publishable/anon env keys.
  - `persistSession: true`.
- `components/DashboardOpportunities.tsx`, `components/SwingPortfolioPanel.tsx`, `components/SwingFiAssistant.tsx`, `components/PickHistoryPanel.tsx`, billing and admin panels fetch APIs with Supabase bearer tokens or admin helper headers.
- `lib/admin-client.ts` stores an optional admin API token in localStorage for trusted admin tooling.
- `lib/customer-store.ts` and `lib/opportunity-store.ts` still contain legacy localStorage/mock customer/opportunity helpers. These should not be used for new Copilot persistence.

## Supabase Schema And RLS

Schema source:

- `db/schema.sql`
- `db/auth-email-verification.sql`
- `db/prediction-outcomes-migration.sql`
- `db/preferred-brokerage-migration.sql`
- `lib/database.types.ts`

Current tables in `db/schema.sql`:

- `users`
- `auth_email_verification_tokens`
- `admin_access_grants`
- `opportunities`
- `agent_runs`
- `opportunity_rankings`
- `backtest_runs`
- `backtest_trades`
- `ranking_calibration_rules`
- `subscriptions`
- `daily_picks`
- `prediction_outcomes`
- `alert_logs`
- `email_link_events`
- `alert_open_events`
- `app_event_logs`
- `customer_monthly_usage`
- `watchlists`
- `watchlist_items`
- `trade_history`

RLS and helper functions:

- Every table above has `alter table ... enable row level security`.
- `current_app_user_id()` resolves `users.id` from `auth.uid()`.
- `current_app_user_is_admin()` checks `users.role = 'admin'`.
- `current_app_user_can_read_public_data()` allows authenticated read or admin read.

Important RLS patterns:

- `users`: own or admin select; own update.
- `opportunities`, `agent_runs`, `opportunity_rankings`: authenticated read.
- `daily_picks`, `subscriptions`, `alert_logs`, `email_link_events`, `alert_open_events`, `customer_monthly_usage`: own or admin read.
- `prediction_outcomes`, `backtest_runs`, `backtest_trades`, `ranking_calibration_rules`, `app_event_logs`: admin read.
- `watchlists`, `watchlist_items`, `trade_history`: user-owned CRUD where relevant.
- There are no client-side insert/update policies for Copilot-specific future tables because those tables do not exist yet.

Server-only access patterns:

- The application frequently uses `createSupabaseAdminClient()` in API routes, then manually scopes rows by `user.id` after validating the Supabase access token.
- This pattern bypasses RLS because it uses the service role. Copilot APIs should keep explicit `eq("user_id", user.id)` checks and should add tests around authorization boundaries.

## Portfolio And Trade-History Data Flow

The current portfolio is manual, read/write, and user-owned:

- Storage table: `trade_history`.
- Type: `TradeHistoryRow` in `lib/database.types.ts`.
- Primary UI: `components/SwingPortfolioPanel.tsx`.
- Page: `app/portfolio/page.tsx`.
- Main API: `app/api/portfolio/route.ts`.

Current create flow:

1. User searches a symbol through `app/api/portfolio/symbol-search/route.ts`.
2. User creates a tracked trade through `POST app/api/portfolio/route.ts`.
3. API resolves the user through `resolveCustomerSession`.
4. API normalizes symbol, asset type, status, quantity, opened date, entry price, optional opportunity id, notes.
5. If target/stop are missing, API calls `buildPortfolioExitPlan()` from `lib/portfolio/exit-plan.ts`.
6. API inserts a `trade_history` row scoped to `user_id`.
7. `GET app/api/portfolio/route.ts` reads only `trade_history` rows with `.eq("user_id", user.id)`, enriches each with FMP profile/news and plan status, then returns the list.

Current update/delete flow:

- `PATCH app/api/portfolio/[id]/route.ts`
  - Requires session.
  - Selects existing row with `.eq("id", id).eq("user_id", user.id)`.
  - Updates status, exit price, notes, `closed_at`, `realized_gain`, and `realized_loss`.
- `DELETE app/api/portfolio/[id]/route.ts`
  - Requires session.
  - Deletes only `.eq("id", id).eq("user_id", user.id)`.

Existing portfolio intelligence:

- `lib/portfolio/exit-plan.ts`
  - `buildPortfolioExitPlan({ symbol, entryPrice })`
  - First attempts `buildDailyAnalysisPlan()` from latest saved SwingFi opportunity.
  - Falls back to `buildMarketStructurePlan()` using FMP profile/candles.
  - Produces deterministic target, stop, trailing stop, holding window, reward/risk, checklist, invalidation signals, confidence, and data-quality label.
- `lib/portfolio/intelligence.ts`
  - `getTradeLiveIntelligence()`
  - Uses current price, entry, target, stop, unrealized return, latest news, days held, and holding window.
  - Produces plain-language decision zones such as below stop, profit-review zone, close to saved stop, target watch, inside plan, and hold plan.
- `lib/portfolio/morning-digest.ts`
  - `getMorningPortfolioDigest(userId)`
  - Reads open/planned `trade_history`, enriches with FMP profile/news, and sorts positions by review priority for morning emails.

Existing brokerage handoff:

- `lib/brokerages.ts`: preferred brokerage enum/options.
- `components/BrokerageLaunchPanel.tsx`: opens quote/login pages for Schwab, Fidelity, Robinhood, E*TRADE, and Interactive Brokers. It does not collect brokerage credentials or place trades.

## Market Data And Research Services

FMP:

- `lib/providers/fmp.ts`
  - `getFmpHistoricalCandles`
  - `getFmpIntradayCandles`
  - `searchFmpSymbols`
  - `searchFmpCompanyNames`
  - `getFmpCompanyProfile`
  - `getFmpCompanyScreener`
  - `getFmpIncomeStatements`
  - `getFmpRatiosTtm`
  - `getFmpKeyMetricsTtm`
  - `getFmpStockNews`
  - `getFmpEarnings`
  - `getFmpSecFilingsBySymbol`

SEC EDGAR fallback:

- `lib/providers/sec-edgar.ts`
  - `getSecSubmissionsByCik`
  - Uses `SEC_USER_AGENT` or default `SwingFi/1.0 contact=tradestockswithai@gmail.com`.

Macro/government:

- `lib/providers/fred.ts`
  - `getFredMacroContext()`
  - Live FRED rates, CPI, unemployment, yield curve, SP500 context when `FRED_API_KEY` is present.
  - Neutral fallback if missing/failing.
- `lib/providers/bls.ts`
  - `getBlsMacroContext()`
  - Keyless or keyed BLS CPI/unemployment/earnings context.
  - Neutral fallback on failure.
- `lib/providers/treasury.ts`
  - `getTreasuryMacroContext()`
  - Public Treasury Fiscal Data exchange-rate context.
  - Neutral fallback on failure.

Opportunity ranking:

- `lib/agent/fmp-equity-universe.ts`
  - `runFmpDailyRankingAgent()`
  - Broad FMP screener attempts with progressively looser filters.
  - Initial price-only technical pass.
  - Quality and viability gates.
  - Enrichment of strongest symbols with fundamentals, news, events, filings.
  - Coverage gate via `FMP_MIN_SCREENER_ROWS`, `FMP_MIN_DETAILED_CANDIDATES`, and `DISABLE_MARKET_COVERAGE_GATE`.
- `lib/agent/ranking-agent.ts`
  - `rankEquityCandidates()`
  - `runDailyRankingAgent()` for mock mode.
  - Deterministic scoring across technicals, financials, news, macro, liquidity, risk, confidence, swing setup, reward/risk, benchmark-relative strength, data completeness, and calibration penalties.
- `lib/agent/calibration.ts`, `lib/agent/persisted-calibration.ts`
  - Runtime calibration from static/env or Supabase `ranking_calibration_rules`.

Persistence:

- `lib/persistence.ts`
  - `persistAgentRun()`
  - Saves `agent_runs`, `opportunities`, `opportunity_rankings`, personalized `daily_picks`, and `prediction_outcomes`.
  - `getLatestPersistedMorningRun()`
  - `getMorningAlertRecipients()`
  - `persistAlertLog()`
  - `persistBacktestSummary()`
  - `getLatestBacktestSummary()`
  - `persistEmailLinkClick()`
  - `persistAlertOpen()`
  - `unsubscribeEmailAlerts()`

Prediction tracking:

- `lib/prediction-tracking.ts`
  - `evaluatePendingPredictions()`
  - `getPredictionAccuracySummary()`
  - `persistForwardCalibrationFromPredictions()`
  - Uses FMP candles after the prediction date to determine entry, target hit, stop hit, expiration, no entry, SPY/QQQ benchmark returns, max gain, and drawdown.

Backtesting:

- `lib/backtesting.ts`
  - Rolling historical outcome simulation using FMP candles and current ranking engine.
- `components/BacktestPanel.tsx`
- `components/PredictionAccuracyPanel.tsx`

## OpenAI Integration

- `lib/openai.ts`
  - `generateOpenAiText({ messages, maxTokens })`
  - Uses `OPENAI_API_KEY`.
  - Default model: `OPENAI_MODEL ?? "gpt-4.1-mini"`.
  - Temperature: `0.2`.
  - Returns `mode: "unconfigured"` if no key.
- `app/api/assistant/chat/route.ts`
  - Research-gated.
  - Builds deterministic context from latest opportunities, user profile, tracked portfolio, prediction outcomes, ticker evidence, FMP quote/candles/news/earnings/filings, and live trade intelligence.
  - AI is instructed not to invent prices, returns, headlines, or financials.
  - AI is instructed not to say buy/sell/must/guaranteed.
  - Fallback answer exists when OpenAI is unconfigured.
- `app/api/agent/explain/route.ts`
  - Admin/explanation endpoint using OpenAI with FMP requirement.
- `app/api/insights/opportunities/route.ts`
- `app/api/insights/portfolio/route.ts`
  - Use deterministic fallbacks and OpenAI parsing.

Prompt management and caching:

- Prompts are inline in API routes; there is no dedicated prompt registry.
- `lib/repositories/opportunities.ts` has in-memory caching for latest opportunity list and live preview agent results.
- FMP fetches use Next fetch `revalidate` values.
- There is no centralized OpenAI usage ledger table. Costs are estimated for the ranking agent through `lib/agent/costs.ts`, not logged per OpenAI call.

## Email, SMS, Tracking, And Cron

Email:

- `lib/email.ts`
  - `getEmailDeliveryStatus()`
  - `sendEmail()`
  - Resend endpoint `https://api.resend.com/emails`.
  - `sendAdminFailureAlert()`.
- `lib/email-branding.ts`
  - `buildBrandedEmail()`
  - `buildBrandedMorningEmail()`
  - `brandedButton()`
  - Includes dark-mode safety CSS.
- `lib/alerts.ts`
  - `buildMorningAlertMessage()` for SMS.
  - `buildMorningEmailAlert()` for morning email.
  - Includes analysis tracking links, open pixel URL, unsubscribe URL, and portfolio digest link.

SMS:

- `lib/twilio.ts`
  - Sends via Twilio REST API using `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`.
  - Morning SMS delivery is gated by `ENABLE_TWILIO_MORNING_ALERTS`.

Tracking:

- `app/e/[trackingId]/page.tsx`: email/SMS click redirect tracking.
- `app/api/track/open/[trackingId]/route.ts`: email open tracking pixel route.
- `email_link_events` and `alert_open_events` persist engagement.
- `app/api/admin/customers/route.ts` aggregates emails sent, opens, clicks, SMS sends/clicks, and top clicked symbols.

Cron protections:

- Cron routes accept `Authorization: Bearer ${CRON_SECRET}` when `CRON_SECRET` exists.
- Without `CRON_SECRET`, cron routes allow requests only when `NODE_ENV !== "production"`.
- Failures are written to `app_event_logs` through `recordAppEvent()` and emailed via `sendAdminFailureAlert()`.

## Authentication And Subscription Access

Authentication:

- Supabase Auth is used in browser via `lib/supabase/browser.ts`.
- Server validation uses `supabase.auth.getUser(token)` through `resolveCustomerSession`.
- Signup uses `supabase.auth.admin.createUser({ email_confirm: true })` in `app/api/auth/signup/route.ts`.
- SwingFi sends its own branded verification token through `auth_email_verification_tokens`.
- Password reset uses `supabase.auth.admin.generateLink({ type: "recovery" })` and sends a branded email.

Research access:

- `resolveResearchAccess()` requires one of:
  - Approved admin.
  - Verified email plus active 30-day trial by `users.created_at`.
  - Verified email plus active/trialing subscription.
- Admin users bypass customer subscription gates.

Billing:

- `lib/stripe/config.ts`, `lib/stripe/server.ts`, `lib/stripe/subscription-sync.ts`.
- `app/api/billing/checkout/route.ts`, `app/api/billing/portal/route.ts`, `app/api/stripe/webhook/route.ts`.
- Stripe webhook validates `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.

## Feature Flags And Environment Validation

Feature/config flags observed:

- `AGENT_DATA_SOURCE`
- `FMP_UNIVERSE_LIMIT`
- `FMP_DETAILED_LIMIT`
- `FMP_ENRICHMENT_LIMIT`
- `FMP_MIN_SCREENER_ROWS`
- `FMP_MIN_DETAILED_CANDIDATES`
- `FMP_CANDIDATE_DELAY_MS`
- `FMP_CANDIDATE_CONCURRENCY`
- `DISABLE_MARKET_COVERAGE_GATE`
- `ENABLE_LIVE_PREVIEW_FALLBACK`
- `ENABLE_TWILIO_MORNING_ALERTS`
- `STRIPE_CHECKOUT_ENABLED`
- `REQUIRE_LIVE_STRIPE`
- `SWINGFI_ENABLE_CODEX_AUTO_LOGIN`

Environment validation:

- `.env.example` documents required and optional environment variables.
- `scripts/verify-production-env.mjs` checks production env readiness.
- `scripts/verify-production-surface.mjs` checks public production surface.
- `scripts/verify-stripe-readiness.mjs` checks Stripe configuration.

Copilot should add its own default-off flags before any new product behavior:

- `NEXT_PUBLIC_COPILOT_ENABLED=false`
- `COPILOT_READ_PROVIDER=manual`
- `COPILOT_EXTERNAL_BROKERAGE_ENABLED=false`
- `COPILOT_PAPER_TRADING_ENABLED=false`

## Security Findings

These are audit findings only; no fixes were applied.

### Positive Controls

- Server-side provider keys are read from `process.env` in server utilities and routes.
- Supabase service-role key is centralized in `lib/supabase/server.ts`.
- Browser Supabase client uses public anon/publishable keys only.
- Research APIs are gated by `resolveResearchAccess`.
- Portfolio APIs validate the customer token and scope by `user.id`.
- Admin APIs are gated by `isAdminApiRequest`.
- Cron routes are protected by `CRON_SECRET` in production.
- Stripe webhook validates the Stripe signature.
- RLS is declared for all schema tables in `db/schema.sql`.
- Brokerage handoff does not collect account passwords.

### Risks To Address Before Copilot

- Service-role access is used in many API routes. This is workable but increases reliance on explicit `.eq("user_id", user.id)` authorization. New Copilot endpoints need tests proving cross-user access is impossible.
- `lib/admin-client.ts` stores an admin API token in browser localStorage. That should not be reused for Copilot provider secrets or brokerage tokens.
- Legacy `lib/customer-store.ts` stores mock/local customers and passwords in localStorage. This should not be used by Copilot or any production-auth path.
- Existing prompts are inline. Copilot should avoid duplicating prompt logic in multiple API routes.
- There is no dedicated AI usage log. Copilot should log narrator calls if cost and auditability matter.
- `app/api/assistant/chat/route.ts` reads `prediction_outcomes` through the service-role Supabase client after customer session resolution. Prediction outcomes are admin-only in RLS, but this server route can include aggregated outcome context for customers. Future Copilot should explicitly define which performance data customers can see.
- `app/api/dev/codex-session/route.ts` exists for local-only Codex auto-login and must remain disabled in production.
- `components/AdminCommunicationsPanel.tsx` previews HTML with `dangerouslySetInnerHTML`. It is admin-facing, but Copilot should avoid accepting arbitrary HTML from users.
- `lib/persistence.ts` has a duplicated `if (!supabase) return notConfigured();` in `persistPredictionLedger()`. Harmless, but worth cleaning in a separate non-audit task.
- `app/api/admin/customers/route.ts` currently returns `preferredBrokerage: "none"` instead of selecting the actual `users.preferred_brokerage` column. This is unrelated to Copilot but relevant if admin needs provider visibility later.

## Existing Code Resembling Copilot Building Blocks

Provider adapter candidates:

- `lib/providers/fmp.ts`
- `lib/providers/fred.ts`
- `lib/providers/bls.ts`
- `lib/providers/treasury.ts`
- `lib/providers/sec-edgar.ts`
- `lib/brokerages.ts`

Normalized portfolio model candidates:

- `TradeHistoryRow` in `lib/database.types.ts`.
- `trade_history` table in `db/schema.sql`.
- `app/api/portfolio/route.ts`.
- `lib/portfolio/morning-digest.ts`.

Findings engine candidates:

- `lib/portfolio/intelligence.ts`
- `lib/portfolio/exit-plan.ts`
- `lib/trade-guidance.ts`
- `lib/plain-language-insights.ts`
- `lib/market-intelligence.ts`
- `lib/prediction-tracking.ts`

Report builder candidates:

- `lib/alerts.ts`
- `lib/email-branding.ts`
- `lib/portfolio/morning-digest.ts`
- `app/api/assistant/chat/route.ts`

Order-intent ledger:

- No order-intent ledger exists. `trade_history` tracks user-entered trades after the user decides to track them. `BrokerageLaunchPanel` provides handoff links but does not create orders.

## Unknowns And Assumptions

- No evidence of an external brokerage provider contract, SDK choice, or legal/compliance decision exists in the repository.
- No database migrations for Copilot-specific provider connections, holdings snapshots, reports, or paper orders exist.
- No test framework beyond TypeScript, ESLint, and Next build is configured.
- No dedicated OpenAI usage/cost table exists.
- No provider-token encryption strategy exists in code.
- No live trading, paper trading, withdrawal, transfer, or broker account-linking code exists.
- It is unknown whether all SQL in `db/schema.sql` has been applied to the live Supabase project.
- It is unknown whether current production environment variables match `.env.example` and `scripts/verify-production-env.mjs` without running production checks.

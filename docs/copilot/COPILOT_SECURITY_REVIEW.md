# SwingFi Copilot Security Review

Review date: 2026-07-18

Scope: planned SwingFi Copilot work and existing application paths it will reuse. This review did not add a brokerage provider, connect accounts, place trades, enable paper/live trading, deploy, rotate secrets, or apply migrations.

## Summary

The Copilot foundation is mostly aligned with the research-only constraint:

- Brokerage read contracts expose `canPlaceOrders: false`.
- Copilot feature flags default off.
- Copilot OpenAI narration is server-only and feature-flagged.
- Additive Copilot tables use RLS read policies and composite foreign keys to prevent forged cross-user child relationships.
- Portfolio and dashboard APIs generally derive user identity from a verified Supabase session and filter by the resolved SwingFi `users.id`.

One high-impact issue was fixed in this review: `/api/customers/sync` previously used the service-role Supabase client while trusting browser-supplied identity fields. The route now requires a verified Supabase bearer token, derives email/auth user id server-side, rejects mismatched body email, and ignores client-supplied privilege/verification fields.

## Findings

### Critical

#### Fixed: unauthenticated customer profile sync trusted browser identity

- File/symbol: `/Users/gavin/Documents/ai swing trading/app/api/customers/sync/route.ts` `POST`
- Related fix: `/Users/gavin/Documents/ai swing trading/lib/auth/customer-sync.ts`
- Threat: unauthenticated or malicious clients could submit arbitrary `email`, `authUserId`, `emailVerifiedAt`, and preference data to a service-role upsert path.
- Realistic exploit path: a public request to `/api/customers/sync` could claim `gavin@onefear.co` or another customer email. Before the fix, the route would resolve role from the claimed email and upsert with service-role privileges.
- Affected data: `users` profile rows, role assignment, auth user linkage, email verification timestamp, preferences, and profile metadata.
- Recommended fix: require Supabase bearer auth, derive email and auth user id from `supabase.auth.getUser(token)`, reject mismatched body email, and do not accept browser-supplied role/auth identity/email-verification fields.
- Status: fixed in this task.
- Blocks private owner-only Copilot prototype: yes before fix if publicly reachable; no after fix.
- Blocks multi-user beta: yes before fix; no after fix, assuming the new test remains in CI.

### High

#### Service-role client is used for customer-owned routes

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/auth/customer-session.ts` `resolveCustomerSession`
- Reused by: `/api/portfolio`, `/api/copilot/report`, `/api/assistant/chat`, `/api/daily-picks`, billing routes, and portfolio helper routes.
- Threat: service-role Supabase bypasses RLS, so every customer-owned query must manually apply the resolved `user.id` filter.
- Realistic exploit path: a future route or Copilot provider repository forgets `.eq("user_id", user.id)`, causing cross-user portfolio/report exposure despite RLS.
- Affected data: profiles, trade history, portfolio snapshots, Copilot findings/reports, daily picks, subscriptions, alert logs.
- Recommended fix: keep `resolveCustomerSession` but introduce scoped repositories that require a resolved session user object and make `user_id` filtering non-optional. Add route tests for every user-owned endpoint proving cross-user records are excluded.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: yes until repository-level tests cover customer-owned data access.

#### Copilot persistence schema is additive but not applied by code in this task

- File/symbol: `/Users/gavin/Documents/ai swing trading/db/copilot-schema-migration.sql`
- Threat: code may assume Copilot tables/RLS exist before the migration is applied and verified in Supabase.
- Realistic exploit path: beta enables Copilot UI/report routes while persistence tables are missing or partially migrated, causing degraded behavior or forcing fallback paths that hide data isolation gaps.
- Affected data: brokerage connection metadata, normalized accounts, snapshots, positions, findings, reports.
- Recommended fix: apply migration in a controlled Supabase environment, run `/Users/gavin/Documents/ai swing trading/db/copilot-rls-verification.sql`, and add a production readiness check for required Copilot tables before enabling `COPILOT_ENABLED=true`.
- Blocks private owner-only Copilot prototype: no if fixture/manual mode is used.
- Blocks multi-user beta: yes.

### Medium

#### OpenAI assistant route sends rich user context without durable usage/cost records

- File/symbol: `/Users/gavin/Documents/ai swing trading/app/api/assistant/chat/route.ts` `POST`
- Threat: assistant prompts include user profile preferences, tracked portfolio summaries, ranked opportunities, outcomes, headlines, and event context. The route has useful prompt constraints, but no durable per-user cost/usage record or structured output validator like Copilot narration.
- Realistic exploit path: a prompt-injection style user request attempts to elicit unsupported recommendations, or high usage creates runaway cost without per-user tracking.
- Affected data: portfolio summaries, ranked research context, user preferences, cost metadata.
- Recommended fix: reuse the Copilot narration safety pattern where feasible: input hash, prompt version, validation, fallback status, estimated token cost, and banned phrase checks. Add rate limiting to `/api/assistant/chat`.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: recommended before beta.

#### In-memory rate limiting is not durable across serverless instances

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/rate-limit.ts`
- Threat: auth and password-reset rate limits are per process. In serverless or multi-instance hosting, limits can be bypassed by hitting different instances or waiting for cold starts.
- Realistic exploit path: scripted requests spread across instances could exceed intended signup/password reset/account-status limits.
- Affected data: auth emails, account enumeration surface, transactional email cost.
- Recommended fix: move rate limits to a durable store such as Upstash Redis, Supabase RPC, or Vercel KV before paid beta.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: recommended before beta.

#### Admin model is functional but needs stronger operational governance

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/auth/admin.ts` `isAdminApiRequest`
- Threat: production accepts either `ADMIN_API_SECRET` or Supabase users with role/admin grant. This is workable, but admin changes need audit events and stronger owner controls before a team/admin beta.
- Realistic exploit path: compromised admin session or leaked admin secret can run agent scans, send test communications, alter opportunities, view customers, and grant admin access.
- Affected data: admin operations, customer list, alerts, opportunities, prediction metrics.
- Recommended fix: require MFA at Supabase/identity provider level, rotate `ADMIN_API_SECRET`, log admin grant/revoke actions, and show last admin action history in admin.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: recommended before beta.

#### Operational logs may retain more PII than necessary

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/persistence.ts` `recordAppEvent`, `persistAlertLog`; `/Users/gavin/Documents/ai swing trading/lib/email.ts` `sendAdminFailureAlert`
- Threat: alert logs store recipients and message bodies; app event metadata can store provider errors, user ids, and operational context.
- Realistic exploit path: admin dashboard or database access exposes historical customer emails, phone numbers, alert bodies, or detailed errors.
- Affected data: emails, phone numbers, customer ids, alert contents, provider errors.
- Recommended fix: define retention windows, redact recipients in broad admin feeds, store hashed recipient keys for aggregate metrics, and keep full delivery payload access owner-only.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: recommended before beta.

### Low

#### Production cron security depends on `CRON_SECRET`

- File/symbol: `/Users/gavin/Documents/ai swing trading/app/api/cron/daily-rankings/route.ts`, `/api/cron/morning-alerts`, `/api/cron/prediction-evaluation`
- Threat: cron endpoints reject unauthorized production requests only when `CRON_SECRET` is configured. The helper allows no-secret execution outside production for local development.
- Realistic exploit path: a misconfigured production-like deployment without `CRON_SECRET` could be triggered unexpectedly if `NODE_ENV` is not production.
- Affected data: agent runs, email sends, prediction evaluation, FMP/OpenAI/Resend cost.
- Recommended fix: keep `npm run production:env` in deployment checks and consider requiring `CRON_SECRET` whenever `NEXT_PUBLIC_APP_URL` is a public SwingFi domain.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: no if production env validation passes.

#### Stripe webhook verification is present, but errors echo provider messages

- File/symbol: `/Users/gavin/Documents/ai swing trading/app/api/stripe/webhook/route.ts` `POST`
- Threat: Stripe signature verification is implemented correctly with raw request text, but error responses can include provider error text.
- Realistic exploit path: malformed webhook requests receive detailed signature failure strings.
- Affected data: webhook configuration metadata, not customer financial data.
- Recommended fix: return a generic `Invalid webhook signature` response and log detailed sanitized errors server-side only.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: no, low cleanup.

#### Local Stripe setup script prints generated secrets

- File/symbol: `/Users/gavin/Documents/ai swing trading/scripts/setup-stripe-products.mjs`
- Threat: the setup script prints env lines including `STRIPE_WEBHOOK_SECRET`.
- Realistic exploit path: copied terminal logs or shared screenshots expose setup secrets.
- Affected data: Stripe webhook secret.
- Recommended fix: keep this script local-only or add a `--redact` default that masks secret values.
- Blocks private owner-only Copilot prototype: no.
- Blocks multi-user beta: no.

### Informational

#### Copilot feature flags default off

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/copilot/config.ts`
- Finding: `COPILOT_ENABLED`, `BROKERAGE_CONNECTIONS_ENABLED`, and `PAPER_TRADING_ENABLED` default to `false`.
- Impact: good default posture for unfinished Copilot work.

#### Copilot narrator has stronger safety boundaries than general assistant chat

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/copilot/openai-narrator.ts`
- Finding: Copilot narration is server-only, feature-flagged, cached by input hash, timeout-protected, and falls back to deterministic narration on validation/provider failure.
- Impact: this is the right model for future Copilot report text.

#### Paper execution core is isolated and not user-facing

- File/symbol: `/Users/gavin/Documents/ai swing trading/lib/copilot/paper-execution.ts`
- Finding: paper execution has no public routes/UI, defaults disabled, rejects live mode, rejects unsupported behaviors, and returns `llmOverrideAllowed: false`.
- Impact: safe architectural foundation as long as it remains behind feature flags and no live provider is added.

## Fixes Implemented In This Review

- Added `/Users/gavin/Documents/ai swing trading/lib/auth/customer-sync.ts`.
- Updated `/Users/gavin/Documents/ai swing trading/app/api/customers/sync/route.ts` to require a Supabase bearer token and derive identity server-side.
- Updated `/Users/gavin/Documents/ai swing trading/lib/customer-store.ts` to send the current Supabase access token to `/api/customers/sync` and skip database sync when no verified session exists.
- Added `/Users/gavin/Documents/ai swing trading/tests/customer-sync-security.test.ts`.
- Added `/Users/gavin/Documents/ai swing trading/tests/tsconfig.security.json`.
- Added `npm run test:security`.

## Verification Items Before Multi-User Beta

- Set `NEXT_PUBLIC_APP_URL=https://www.swingfi.trade` in production. `npm run production:env` failed in this local environment because that value is not currently set to the production SwingFi URL.
- Apply and verify Copilot migration in Supabase.
- Run `db/copilot-rls-verification.sql` against a non-production Supabase database.
- Add durable rate limiting.
- Add route-level user-isolation tests for every service-role customer route.
- Add admin action audit logs for admin grants/revokes and high-cost operations.
- Add OpenAI usage/cost logging with input hashes, not raw portfolio payloads.
- Add retention/redaction policy for alert logs and app event metadata.
- Confirm production env checks are mandatory in deployment.

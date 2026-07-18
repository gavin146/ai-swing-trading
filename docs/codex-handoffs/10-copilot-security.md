# 10 - Copilot Security Review Handoff

## Task

Performed a focused security, authorization, RLS, observability, and production-safety sweep for planned SwingFi Copilot work and existing app paths it will reuse. No brokerage provider, account connection, trading route, paper/live enablement, deployment, secret rotation, or production migration was added.

## Inspected Paths

- `/Users/gavin/Documents/ai swing trading/lib/supabase/server.ts`
- `/Users/gavin/Documents/ai swing trading/lib/supabase/browser.ts`
- `/Users/gavin/Documents/ai swing trading/lib/auth/admin.ts`
- `/Users/gavin/Documents/ai swing trading/lib/auth/customer-session.ts`
- `/Users/gavin/Documents/ai swing trading/lib/auth/research-access.ts`
- `/Users/gavin/Documents/ai swing trading/lib/admin-client.ts`
- `/Users/gavin/Documents/ai swing trading/lib/openai.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/openai-narrator.ts`
- `/Users/gavin/Documents/ai swing trading/lib/copilot/paper-execution.ts`
- `/Users/gavin/Documents/ai swing trading/lib/email.ts`
- `/Users/gavin/Documents/ai swing trading/lib/rate-limit.ts`
- `/Users/gavin/Documents/ai swing trading/lib/customer-store.ts`
- `/Users/gavin/Documents/ai swing trading/app/api/admin/*`
- `/Users/gavin/Documents/ai swing trading/app/api/cron/*`
- `/Users/gavin/Documents/ai swing trading/app/api/customers/session/route.ts`
- `/Users/gavin/Documents/ai swing trading/app/api/customers/sync/route.ts`
- `/Users/gavin/Documents/ai swing trading/app/api/portfolio/*`
- `/Users/gavin/Documents/ai swing trading/app/api/copilot/report/route.ts`
- `/Users/gavin/Documents/ai swing trading/app/api/assistant/chat/route.ts`
- `/Users/gavin/Documents/ai swing trading/app/api/stripe/webhook/route.ts`
- `/Users/gavin/Documents/ai swing trading/app/api/billing/*`
- `/Users/gavin/Documents/ai swing trading/db/schema.sql`
- `/Users/gavin/Documents/ai swing trading/db/copilot-schema-migration.sql`
- `/Users/gavin/Documents/ai swing trading/db/copilot-rls-verification.sql`
- `/Users/gavin/Documents/ai swing trading/scripts/verify-production-env.mjs`

No app-level `AGENTS.md` was present. The only `AGENTS.md` files found in this workspace were dependency-level Supabase files under `node_modules` and an unrelated sibling project.

## Files Changed

- `/Users/gavin/Documents/ai swing trading/app/api/customers/sync/route.ts`
- `/Users/gavin/Documents/ai swing trading/lib/auth/customer-sync.ts`
- `/Users/gavin/Documents/ai swing trading/lib/customer-store.ts`
- `/Users/gavin/Documents/ai swing trading/tests/customer-sync-security.test.ts`
- `/Users/gavin/Documents/ai swing trading/tests/tsconfig.security.json`
- `/Users/gavin/Documents/ai swing trading/package.json`
- `/Users/gavin/Documents/ai swing trading/docs/copilot/COPILOT_SECURITY_REVIEW.md`
- `/Users/gavin/Documents/ai swing trading/docs/copilot/COPILOT_OBSERVABILITY_SPEC.md`
- `/Users/gavin/Documents/ai swing trading/docs/codex-handoffs/10-copilot-security.md`

## Narrow Fix Implemented

`/api/customers/sync` previously trusted browser-supplied email and identity fields while using the Supabase service-role client. It now:

- requires an Authorization bearer token
- verifies the token with `supabase.auth.getUser`
- derives email and auth user id server-side
- rejects mismatched body email
- ignores client-supplied `authUserId`, `createdAt`, `emailVerifiedAt`, and `role`
- keeps customer preference syncing intact

The browser sync helper now sends the current Supabase access token and skips DB sync if no verified Supabase session exists.

## Tests Added

`/Users/gavin/Documents/ai swing trading/tests/customer-sync-security.test.ts` covers:

- mismatched email rejection
- hostile identity/role/email-verification fields ignored
- empty body email allowed when session identity is verified

## Commands Run

- `npm run test:security` - passed
- `npm run test:copilot` - passed
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run verify` - passed
- `npm run production:env` - failed with one production env failure and one warning:
  - `NEXT_PUBLIC_APP_URL` is not set to `https://www.swingfi.trade` in the current environment.
  - `BLS_API_KEY` is optional and missing; keyless BLS can still work with lower limits.

## Major Risks Remaining

- Customer-owned routes use service-role Supabase and rely on manual `user_id` filters. Add scoped repositories and route-level isolation tests before multi-user Copilot beta.
- Copilot schema/RLS must be applied and verified in Supabase before persistent multi-user Copilot is enabled.
- Assistant chat has less structured output validation and cost logging than Copilot narration.
- In-memory rate limiting is not durable across serverless instances.
- Admin actions need stronger audit logging and operational governance.
- Alert/app event logs need retention and redaction rules before wider beta.

## Recommended Next PR

Create scoped customer repositories for portfolio/trade-history/Copilot data access that require a resolved session user and cannot run without the user id. Add tests proving user A cannot read, update, or delete user B records through each customer API route.

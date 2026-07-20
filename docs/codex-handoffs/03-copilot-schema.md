# Codex Handoff: Copilot Schema And RLS

Date: 2026-07-17, repaired 2026-07-19

## Task

Create additive Supabase/PostgreSQL schema and RLS foundations for future read-only SwingFi Copilot portfolio data and generated reports.

## Files Changed

- `db/copilot-schema-migration.sql`
- `db/copilot-schema-rollback.sql`
- `db/copilot-rls-verification.sql`
- `docs/copilot/COPILOT_DATA_MODEL.md`
- `docs/copilot/COPILOT_RLS_THREAT_MODEL.md`
- `docs/codex-handoffs/03-copilot-schema.md`

## Tables Added

- `brokerage_connections`
- `brokerage_accounts`
- `portfolio_sync_runs`
- `portfolio_snapshots`
- `portfolio_positions`
- `copilot_findings`
- `copilot_reports`

## Existing Tables Reused

- `users`
- `trade_history`
- `opportunities`

The schema adds `copilot_trade_history_id_user_id_uidx` so future Copilot positions can safely link to `trade_history(id, user_id)` without allowing forged cross-user references.

The 2026-07-19 repair adds `portfolio_positions_id_user_id_uidx` before `copilot_findings(position_id, user_id)` references `portfolio_positions(id, user_id)`.

## Policy Decisions

- Copilot remains read-only research software.
- No brokerage provider was selected.
- No brokerage SDK was installed.
- No live-trading, order-placement, paper-trading, or brokerage credential storage was added.
- No password, raw token, refresh token, access token, API key, or unencrypted provider secret columns were introduced.
- Every new table has RLS enabled.
- Read policies allow only the owning user or an admin.
- No insert, update, or delete policies were added for the new Copilot tables.
- Future writes should happen only through server-only APIs with explicit user scoping.
- Composite foreign keys include `user_id` to prevent forged child rows.
- Composite owner-safe relationships use `on delete cascade` because `user_id` is required and cannot be nulled.
- No `updated_at` triggers were added because the current schema has no shared trigger convention.

## Verification Added

- `db/copilot-rls-verification.sql`
  - Seeds rollback-only local fixture users and Copilot rows.
  - Verifies user A and user B can read only their own rows.
  - Verifies user A cannot read user B rows across connections, accounts, sync runs, snapshots, positions, findings, and reports.
  - Verifies anonymous users cannot read customer-owned Copilot rows.
  - Verifies authenticated customers cannot insert, update, or delete Copilot rows without write policies.
  - Verifies forged child foreign-key rejection for connection and position references.
  - Verifies approved admin read access.
  - Includes an information-schema check for secret-like column names.
  - Raises an exception when any recorded check fails.

## 2026-07-19 Repair Verification

- `scripts/validate-copilot-sql.mjs`
  - Added static checks for migration transaction boundaries.
  - Added static checks that `trade_history(id, user_id)` and `portfolio_positions(id, user_id)` unique indexes exist before their referencing foreign keys.
  - Added static checks for rollback coverage and fail-closed RLS verification.
- `npm run test:copilot` now runs the SQL static validator before the Copilot TypeScript tests.

## Commands Run

- `find .. -name AGENTS.md -print`
  - Result: no project-level `AGENTS.md`; only unrelated/dependency files found.
- `sed` and `rg` inspection commands across `db/schema.sql`, existing migrations, routes, Supabase helpers, portfolio APIs, Copilot core files, and package scripts.
  - Result: existing conventions identified.

## Verification

- SQL-specific migration lint/test script
  - Result: none found in `package.json` or the repository file list.
  - Follow-up: run `db/copilot-schema-migration.sql` and `db/copilot-rls-verification.sql` in local Supabase before production.
- `rg -n "on delete set null|password|token|secret|api[_ -]?key|refresh|access[_ -]?token|credential" ...`
  - Result: reviewed expected matches.
  - Only SQL `on delete set null` remaining in the migration is `portfolio_positions.opportunity_id`, a nullable simple reference to the non-user-owned `opportunities` table.
  - Secret-like terms only appear in comments/documentation and in the verification query; no secret-like columns were introduced.
- `psql --version || true`
  - Result: `psql` is not installed in this local environment, so SQL was not executed locally.
- `npm run test:copilot`
  - Result: passed.
  - Output: `Copilot core contract tests passed.`
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

## Untested Assumptions

- Local Supabase was not confirmed available when the migration was authored.
- The migration was not applied to production.
- SQL/RLS verification should be run against local Supabase before production use.
- Future provider adapters will keep credential material outside these tables.
- Future service-role repository methods will scope every query by authenticated `user_id`.

## Recommended Next PR

Build a server-only Copilot repository layer behind `COPILOT_ENABLED=false` that can persist manual `trade_history` snapshots into these tables in local development only. Include tests proving service-role methods always bind `user_id` and never accept browser-supplied ownership fields.

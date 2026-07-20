# Copilot SQL And RLS Repair

Date: 2026-07-19
Branch: `codex/copilot-stabilization`

## Scope

Completed repair prompt 13 from `repairprompts#3.md`.

This task repaired the additive Copilot SQL migration, rollback, and RLS verification scripts. No production or shared Supabase database was touched.

## Files Changed

- `db/copilot-schema-migration.sql`
- `db/copilot-schema-rollback.sql`
- `db/copilot-rls-verification.sql`
- `scripts/validate-copilot-sql.mjs`
- `package.json`
- `docs/copilot/COPILOT_DATA_MODEL.md`
- `docs/copilot/COPILOT_RLS_THREAT_MODEL.md`
- `docs/codex-handoffs/03-copilot-schema.md`
- `docs/codex-handoffs/14-copilot-sql-rls-repair.md`

## Migration Repairs

- Wrapped the forward migration in explicit `begin` / `commit`.
- Added `portfolio_positions_id_user_id_uidx` before `copilot_findings(position_id, user_id)` references `portfolio_positions(id, user_id)`.
- Renamed the shared-table composite FK helper index to `copilot_trade_history_id_user_id_uidx` so ownership is clear.
- Kept all composite user-owned references scoped by `(id, user_id)`.
- Left feature behavior unchanged.

## Rollback Repairs

- Wrapped rollback in explicit `begin` / `commit`.
- Dropped Copilot policies only when the target Copilot table exists.
- Drops Copilot tables in dependency order.
- Drops only the Copilot-created shared-table index `copilot_trade_history_id_user_id_uidx`.
- Does not drop pre-existing shared objects.

## RLS Verification Repairs

The verifier now records and fail-closes checks for:

- User A can read only user A Copilot rows.
- User B can read only user B Copilot rows.
- User A cannot read user B connections, accounts, sync runs, snapshots, positions, findings, or reports.
- Anonymous users cannot read customer-owned Copilot rows.
- Authenticated customers cannot insert, update, or delete Copilot rows when no write policy exists.
- Forged child rows using another user's parent connection or position are rejected.
- Approved admin users can read expected Copilot rows.
- No secret-like columns exist in the Copilot tables.

The script raises an exception if any recorded check has `passed = false`.

## Static Validation

Added `scripts/validate-copilot-sql.mjs` and wired it into `npm run test:copilot`.

Static validation checks:

- Forward migration starts with `begin` and ends with `commit`.
- Rollback starts with `begin` and ends with `commit`.
- `trade_history(id, user_id)` unique index exists before the composite FK references it.
- `portfolio_positions(id, user_id)` unique index exists before the composite FK references it.
- Rollback covers all Copilot tables and the Copilot-created shared index.
- RLS verifier contains a fail-closed assertion.

## Database Execution

Local database execution was not run because this environment has no available `psql`, Supabase CLI, or Docker database.

Commands checked:

- `command -v psql || true`
- `command -v supabase || true`
- `docker ps --format '{{.Names}}' 2>/dev/null | head`

All returned no available disposable database tooling. SQL verification for this task is static only.

## Follow-Up

Before any production migration:

1. Apply `db/copilot-schema-migration.sql` to a disposable local Supabase/PostgreSQL database.
2. Run `psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/copilot-rls-verification.sql`.
3. Run `psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/copilot-schema-rollback.sql`.
4. Apply the migration again to prove rollback/reapply works.

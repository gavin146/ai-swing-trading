# SwingFi Copilot RLS Threat Model

Last updated: 2026-07-17

This threat model covers the additive Copilot persistence schema in `db/copilot-schema-migration.sql`.

## Security Goals

- Users must not read another user's portfolio connections, accounts, sync runs, snapshots, positions, findings, or reports.
- A user must not be able to forge a child row that points at another user's parent row.
- Browser clients must not receive service-role access or broad write permissions.
- Provider credentials, passwords, raw account tokens, refresh tokens, access tokens, API keys, and unencrypted secrets must not be stored in these tables.
- Copilot must stay read-only and must not store order-placement instructions or live-trading state.

## Trust Boundaries

Trusted server-only boundary:

- `lib/supabase/server.ts`
- API routes that call `resolveCustomerSession()` or admin authorization helpers.
- Future Copilot repositories that use service-role access with explicit `.eq("user_id", user.id)` scoping.

Untrusted or lower-trust boundary:

- Browser components.
- Public view models.
- User-supplied portfolio inputs.
- Future external provider responses before normalization and redaction.

## RLS Design

The migration enables RLS on:

- `brokerage_connections`
- `brokerage_accounts`
- `portfolio_sync_runs`
- `portfolio_snapshots`
- `portfolio_positions`
- `copilot_findings`
- `copilot_reports`

Each table has a select policy:

```sql
for select using (user_id = current_app_user_id() or current_app_user_is_admin())
```

This follows the existing SwingFi helper functions in `db/schema.sql`:

- `current_app_user_id()`
- `current_app_user_is_admin()`

No insert, update, or delete policies are added for Copilot tables. That is intentional. Future Copilot writes should happen through server-only code after authenticating the user and explicitly binding `user_id` server-side.

## Forged Foreign-Key Defense

Child tables include `user_id` and use composite foreign keys where the parent is also user-owned:

- `brokerage_accounts(connection_id, user_id)` references `brokerage_connections(id, user_id)`.
- `portfolio_sync_runs(connection_id, user_id)` references `brokerage_connections(id, user_id)`.
- `portfolio_snapshots(connection_id, user_id)` references `brokerage_connections(id, user_id)`.
- `portfolio_snapshots(account_id, user_id)` references `brokerage_accounts(id, user_id)`.
- `portfolio_snapshots(sync_run_id, user_id)` references `portfolio_sync_runs(id, user_id)`.
- `portfolio_positions(snapshot_id, user_id)` references `portfolio_snapshots(id, user_id)`.
- `portfolio_positions(account_id, user_id)` references `brokerage_accounts(id, user_id)`.
- `portfolio_positions(source_trade_history_id, user_id)` references `trade_history(id, user_id)`.
- `copilot_findings(account_id, user_id)` references `brokerage_accounts(id, user_id)`.
- `copilot_findings(position_id, user_id)` references `portfolio_positions(id, user_id)`.
- `copilot_findings(input_snapshot_id, user_id)` references `portfolio_snapshots(id, user_id)`.

This blocks a forged child row where `user_id` belongs to one user but the parent id belongs to another.

## Deletion Behavior

Composite owner-safe relationships use `on delete cascade` instead of plain `on delete set null`. Plain `set null` would try to null both the child reference and `user_id`, but `user_id` is required.

Important consequences:

- Deleting a connection deletes its accounts, sync runs, snapshots, positions, and dependent findings.
- Deleting a snapshot deletes its positions and dependent findings.
- Deleting a user deletes all user-owned Copilot rows.
- `portfolio_positions.opportunity_id` remains a nullable simple reference to `opportunities(id) on delete set null` because `opportunities` is not user-owned.

If SwingFi later needs immutable audit retention after disconnect, prefer status fields such as `disconnected` or `archived` rather than deleting parent rows.

## Secret Storage Threat

The migration intentionally does not add columns with names or purposes such as:

- `password`
- `token`
- `access_token`
- `refresh_token`
- `api_key`
- `secret`
- raw provider credential payloads

Allowed provider references are opaque identifiers only:

- `external_connection_id`
- `external_account_id`
- `source_position_id`
- `provider_sync_key`

These must never contain credentials. Future encrypted credential storage, if needed, should live in a separate audited design with strict server-only access and should not be exposed through browser-safe models.

## Client Write Threat

Broad client writes are intentionally absent. This avoids:

- Users fabricating provider sync runs.
- Users injecting fake provider metadata.
- Users creating reports for another user.
- Users attaching their row to another user's account or snapshot.

Future server-only APIs should still validate ownership manually because service-role access bypasses RLS.

## AI And Report Safety

`copilot_reports` separates:

- `structured_input`: sanitized evidence.
- `deterministic_summary`: numeric calculations produced by code.
- `narrative_text`: optional narration.

Policy decision:

- AI may explain evidence.
- AI must not invent prices, returns, stops, targets, quantities, positions, or account values.
- Direct "buy now", "sell now", "guaranteed", or live-trading language remains out of bounds.

## Verification Plan

`db/copilot-rls-verification.sql` is a local verification fixture. It is wrapped in `begin` / `rollback` and covers:

- User A versus user B isolation.
- Forged child foreign-key rejection.
- Provider metadata isolation.
- Copilot report and finding isolation.
- Secret-like column detection.

The repository does not currently include a dedicated SQL/RLS automated test runner. Before production migration, run the verification fixture in a local Supabase environment where authenticated JWT claims can be simulated, then capture the results in a handoff.

## Untested Assumptions

- Supabase local roles and `auth.uid()` behavior will match production when the verification fixture is executed.
- Future Copilot repositories will not expose service-role writes directly to the browser.
- Future provider adapters will normalize and redact data before inserting rows.
- Future admin views will continue using existing server-only admin authorization helpers.

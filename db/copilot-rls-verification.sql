-- Verification SQL for local Supabase/PostgreSQL only.
-- Do not run this against production. The fixture is wrapped in a rollback, but it still creates
-- temporary test rows while the transaction is open.
--
-- Expected usage after applying db/copilot-schema-migration.sql to local Supabase:
--   psql "$LOCAL_SUPABASE_DB_URL" -f db/copilot-rls-verification.sql

begin;

create temporary table copilot_rls_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
);

insert into users(id, auth_user_id, email, full_name, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'copilot-rls-user-a@example.test',
    'Copilot RLS User A',
    'customer'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'copilot-rls-user-b@example.test',
    'Copilot RLS User B',
    'customer'
  );

insert into brokerage_connections(id, user_id, provider_id, external_connection_id, status)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'manual_trade_history',
    'rls-user-a-connection',
    'connected'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'manual_trade_history',
    'rls-user-b-connection',
    'connected'
  );

insert into brokerage_accounts(id, user_id, connection_id, external_account_id, display_name, data_as_of)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'rls-user-a-account',
    'User A Account',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'rls-user-b-account',
    'User B Account',
    now()
  );

insert into portfolio_sync_runs(id, user_id, connection_id, provider_sync_key, status)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'rls-user-a-sync',
    'completed'
  );

insert into portfolio_snapshots(
  id,
  user_id,
  connection_id,
  account_id,
  sync_run_id,
  source_type,
  total_value,
  cash_value,
  invested_value,
  completeness,
  status,
  data_as_of,
  source_hash
)
values (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'manual',
  1000,
  100,
  900,
  '{"positions": "complete"}',
  'complete',
  now(),
  'rls-user-a-snapshot'
);

insert into portfolio_positions(
  id,
  user_id,
  snapshot_id,
  account_id,
  symbol,
  asset_type,
  quantity,
  average_cost,
  market_price,
  market_value,
  data_as_of
)
values (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'AAPL',
  'stock',
  2,
  150,
  160,
  320,
  now()
);

insert into copilot_findings(id, user_id, account_id, position_id, symbol, finding_type, severity, evidence, message, input_snapshot_id)
values (
  '80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  'AAPL',
  'INSIDE_ORIGINAL_PLAN',
  'info',
  '[{"label":"test","value":"safe","source":"fixture"}]',
  'Fixture finding for user A.',
  '60000000-0000-4000-8000-000000000001'
);

insert into copilot_reports(id, user_id, report_date, portfolio_data_as_of, structured_input, deterministic_summary, input_hash)
values (
  '90000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  current_date,
  now(),
  '{"fixture": true}',
  '{"positionCount": 1}',
  'rls-user-a-report'
);

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into portfolio_snapshots(
      id,
      user_id,
      connection_id,
      source_type,
      data_as_of,
      source_hash
    )
    values (
      '60000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'brokerage',
      now(),
      'forged-user-b-connection'
    );
  exception
    when foreign_key_violation then
      rejected := true;
  end;

  insert into copilot_rls_results(check_name, passed, detail)
  values (
    'forged_child_foreign_key_rejected',
    rejected,
    'User A snapshot pointing at user B connection must be rejected by composite FK.'
  );
end $$;

insert into copilot_rls_results(check_name, passed, detail)
select
  'no_secret_like_columns',
  count(*) = 0,
  'Secret-like column count: ' || count(*)::text
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'brokerage_connections',
    'brokerage_accounts',
    'portfolio_sync_runs',
    'portfolio_snapshots',
    'portfolio_positions',
    'copilot_findings',
    'copilot_reports'
  )
  and column_name ~* '(password|token|secret|api[_]?key|refresh|access[_]?token|credential)';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);

select
  'user_a_connection_isolation',
  count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'),
  'User A visible brokerage_connections count: ' || count(*)::text
from brokerage_connections
union all
select
  'user_a_cannot_read_user_b_provider_metadata',
  count(*) = 0,
  'User A visible rows for user B connection id: ' || count(*)::text
from brokerage_connections
where id = '30000000-0000-4000-8000-000000000002'
union all
select
  'user_a_report_isolation',
  count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'),
  'User A visible copilot_reports count: ' || count(*)::text
from copilot_reports
union all
select
  'user_a_finding_isolation',
  count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'),
  'User A visible copilot_findings count: ' || count(*)::text
from copilot_findings;

reset role;

select * from copilot_rls_results order by check_name;

rollback;

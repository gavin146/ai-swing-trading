-- Verification SQL for local Supabase/PostgreSQL only.
-- Do not run this against production. The fixture is wrapped in a transaction that
-- rolls back on success and aborts on failure.
--
-- Expected usage after applying db/copilot-schema-migration.sql to local Supabase:
--   psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/copilot-rls-verification.sql

begin;

create temporary table copilot_rls_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create or replace function pg_temp.record_copilot_rls_check(
  check_name text,
  passed boolean,
  detail text
)
returns void
language plpgsql
as $$
begin
  insert into copilot_rls_results(check_name, passed, detail)
  values (check_name, passed, detail);
end $$;

create or replace function pg_temp.record_blocked_insert(
  check_name text,
  statement text
)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
    perform pg_temp.record_copilot_rls_check(check_name, false, 'Insert unexpectedly succeeded.');
  exception
    when others then
      perform pg_temp.record_copilot_rls_check(check_name, true, 'Insert blocked with SQLSTATE ' || sqlstate || '.');
  end;
end $$;

create or replace function pg_temp.record_blocked_write(
  check_name text,
  statement text
)
returns void
language plpgsql
as $$
declare
  affected integer := 0;
begin
  begin
    execute statement;
    get diagnostics affected = row_count;
    perform pg_temp.record_copilot_rls_check(
      check_name,
      affected = 0,
      'Rows affected: ' || affected::text || '.'
    );
  exception
    when others then
      perform pg_temp.record_copilot_rls_check(check_name, true, 'Write blocked with SQLSTATE ' || sqlstate || '.');
  end;
end $$;

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
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'copilot-rls-admin@example.test',
    'Copilot RLS Admin',
    'admin'
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
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'rls-user-b-sync',
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
values
  (
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
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'manual',
    2000,
    200,
    1800,
    '{"positions": "complete"}',
    'complete',
    now(),
    'rls-user-b-snapshot'
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
values
  (
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
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'MSFT',
    'stock',
    3,
    220,
    230,
    690,
    now()
  );

insert into copilot_findings(id, user_id, account_id, position_id, symbol, finding_type, severity, evidence, message, input_snapshot_id)
values
  (
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
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'MSFT',
    'INSIDE_ORIGINAL_PLAN',
    'info',
    '[{"label":"test","value":"safe","source":"fixture"}]',
    'Fixture finding for user B.',
    '60000000-0000-4000-8000-000000000002'
  );

insert into copilot_reports(id, user_id, report_date, portfolio_data_as_of, structured_input, deterministic_summary, input_hash)
values
  (
    '90000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    current_date,
    now(),
    '{"fixture": true}',
    '{"positionCount": 1}',
    'rls-user-a-report'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    current_date,
    now(),
    '{"fixture": true}',
    '{"positionCount": 1}',
    'rls-user-b-report'
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

  perform pg_temp.record_copilot_rls_check(
    'forged_snapshot_parent_connection_rejected',
    rejected,
    'User A snapshot pointing at user B connection must be rejected by composite FK.'
  );
end $$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into copilot_findings(id, user_id, position_id, symbol, finding_type, severity, evidence, message)
    values (
      '80000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000002',
      'MSFT',
      'INSIDE_ORIGINAL_PLAN',
      'info',
      '[]',
      'Forged finding should not insert.'
    );
  exception
    when foreign_key_violation then
      rejected := true;
  end;

  perform pg_temp.record_copilot_rls_check(
    'forged_finding_parent_position_rejected',
    rejected,
    'User A finding pointing at user B position must be rejected by composite FK.'
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

insert into copilot_rls_results(check_name, passed, detail)
select 'user_a_reads_only_own_brokerage_connections', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from brokerage_connections
union all select 'user_a_reads_only_own_brokerage_accounts', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from brokerage_accounts
union all select 'user_a_reads_only_own_portfolio_sync_runs', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from portfolio_sync_runs
union all select 'user_a_reads_only_own_portfolio_snapshots', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from portfolio_snapshots
union all select 'user_a_reads_only_own_portfolio_positions', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from portfolio_positions
union all select 'user_a_reads_only_own_copilot_findings', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from copilot_findings
union all select 'user_a_reads_only_own_copilot_reports', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000001'), 'Visible count: ' || count(*)::text from copilot_reports
union all select 'user_a_cannot_read_user_b_connections', count(*) = 0, 'Visible user B rows: ' || count(*)::text from brokerage_connections where id = '30000000-0000-4000-8000-000000000002'
union all select 'user_a_cannot_read_user_b_accounts', count(*) = 0, 'Visible user B rows: ' || count(*)::text from brokerage_accounts where id = '40000000-0000-4000-8000-000000000002'
union all select 'user_a_cannot_read_user_b_sync_runs', count(*) = 0, 'Visible user B rows: ' || count(*)::text from portfolio_sync_runs where id = '50000000-0000-4000-8000-000000000002'
union all select 'user_a_cannot_read_user_b_snapshots', count(*) = 0, 'Visible user B rows: ' || count(*)::text from portfolio_snapshots where id = '60000000-0000-4000-8000-000000000002'
union all select 'user_a_cannot_read_user_b_positions', count(*) = 0, 'Visible user B rows: ' || count(*)::text from portfolio_positions where id = '70000000-0000-4000-8000-000000000002'
union all select 'user_a_cannot_read_user_b_findings', count(*) = 0, 'Visible user B rows: ' || count(*)::text from copilot_findings where id = '80000000-0000-4000-8000-000000000002'
union all select 'user_a_cannot_read_user_b_reports', count(*) = 0, 'Visible user B rows: ' || count(*)::text from copilot_reports where id = '90000000-0000-4000-8000-000000000002';

select pg_temp.record_blocked_insert(
  'customer_insert_blocked_brokerage_connections',
  $$insert into brokerage_connections(id, user_id, provider_id, external_connection_id, status)
    values ('30000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', 'manual_trade_history', 'blocked-insert-connection', 'connected')$$
);
select pg_temp.record_blocked_insert(
  'customer_insert_blocked_brokerage_accounts',
  $$insert into brokerage_accounts(id, user_id, connection_id, external_account_id, display_name, data_as_of)
    values ('40000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'blocked-account', 'Blocked Account', now())$$
);
select pg_temp.record_blocked_insert(
  'customer_insert_blocked_portfolio_sync_runs',
  $$insert into portfolio_sync_runs(id, user_id, connection_id, status)
    values ('50000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'running')$$
);
select pg_temp.record_blocked_insert(
  'customer_insert_blocked_portfolio_snapshots',
  $$insert into portfolio_snapshots(id, user_id, connection_id, source_type, data_as_of, source_hash)
    values ('60000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'manual', now(), 'blocked-snapshot')$$
);
select pg_temp.record_blocked_insert(
  'customer_insert_blocked_portfolio_positions',
  $$insert into portfolio_positions(id, user_id, snapshot_id, symbol, asset_type, data_as_of)
    values ('70000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'AAPL', 'stock', now())$$
);
select pg_temp.record_blocked_insert(
  'customer_insert_blocked_copilot_findings',
  $$insert into copilot_findings(id, user_id, position_id, symbol, finding_type, severity, evidence, message)
    values ('80000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'AAPL', 'INSIDE_ORIGINAL_PLAN', 'info', '[]', 'Blocked insert finding.')$$
);
select pg_temp.record_blocked_insert(
  'customer_insert_blocked_copilot_reports',
  $$insert into copilot_reports(id, user_id, report_date, portfolio_data_as_of, structured_input, deterministic_summary, input_hash)
    values ('90000000-0000-4000-8000-000000000901', '10000000-0000-4000-8000-000000000001', current_date, now(), '{}', '{}', 'blocked-report')$$
);

select pg_temp.record_blocked_write('customer_update_blocked_brokerage_connections', $$update brokerage_connections set status = status where id = '30000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_update_blocked_brokerage_accounts', $$update brokerage_accounts set display_name = display_name where id = '40000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_update_blocked_portfolio_sync_runs', $$update portfolio_sync_runs set status = status where id = '50000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_update_blocked_portfolio_snapshots', $$update portfolio_snapshots set status = status where id = '60000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_update_blocked_portfolio_positions', $$update portfolio_positions set market_price = market_price where id = '70000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_update_blocked_copilot_findings', $$update copilot_findings set message = message where id = '80000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_update_blocked_copilot_reports', $$update copilot_reports set generation_status = generation_status where id = '90000000-0000-4000-8000-000000000001'$$);

select pg_temp.record_blocked_write('customer_delete_blocked_brokerage_connections', $$delete from brokerage_connections where id = '30000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_delete_blocked_brokerage_accounts', $$delete from brokerage_accounts where id = '40000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_delete_blocked_portfolio_sync_runs', $$delete from portfolio_sync_runs where id = '50000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_delete_blocked_portfolio_snapshots', $$delete from portfolio_snapshots where id = '60000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_delete_blocked_portfolio_positions', $$delete from portfolio_positions where id = '70000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_delete_blocked_copilot_findings', $$delete from copilot_findings where id = '80000000-0000-4000-8000-000000000001'$$);
select pg_temp.record_blocked_write('customer_delete_blocked_copilot_reports', $$delete from copilot_reports where id = '90000000-0000-4000-8000-000000000001'$$);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);

insert into copilot_rls_results(check_name, passed, detail)
select 'user_b_reads_only_own_brokerage_connections', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from brokerage_connections
union all select 'user_b_reads_only_own_brokerage_accounts', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from brokerage_accounts
union all select 'user_b_reads_only_own_portfolio_sync_runs', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from portfolio_sync_runs
union all select 'user_b_reads_only_own_portfolio_snapshots', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from portfolio_snapshots
union all select 'user_b_reads_only_own_portfolio_positions', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from portfolio_positions
union all select 'user_b_reads_only_own_copilot_findings', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from copilot_findings
union all select 'user_b_reads_only_own_copilot_reports', count(*) = 1 and bool_and(user_id = '10000000-0000-4000-8000-000000000002'), 'Visible count: ' || count(*)::text from copilot_reports;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

insert into copilot_rls_results(check_name, passed, detail)
select 'anon_cannot_read_brokerage_connections', count(*) = 0, 'Visible count: ' || count(*)::text from brokerage_connections
union all select 'anon_cannot_read_brokerage_accounts', count(*) = 0, 'Visible count: ' || count(*)::text from brokerage_accounts
union all select 'anon_cannot_read_portfolio_sync_runs', count(*) = 0, 'Visible count: ' || count(*)::text from portfolio_sync_runs
union all select 'anon_cannot_read_portfolio_snapshots', count(*) = 0, 'Visible count: ' || count(*)::text from portfolio_snapshots
union all select 'anon_cannot_read_portfolio_positions', count(*) = 0, 'Visible count: ' || count(*)::text from portfolio_positions
union all select 'anon_cannot_read_copilot_findings', count(*) = 0, 'Visible count: ' || count(*)::text from copilot_findings
union all select 'anon_cannot_read_copilot_reports', count(*) = 0, 'Visible count: ' || count(*)::text from copilot_reports;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);

insert into copilot_rls_results(check_name, passed, detail)
select 'approved_admin_reads_brokerage_connections', count(*) = 2, 'Visible count: ' || count(*)::text from brokerage_connections
union all select 'approved_admin_reads_brokerage_accounts', count(*) = 2, 'Visible count: ' || count(*)::text from brokerage_accounts
union all select 'approved_admin_reads_portfolio_sync_runs', count(*) = 2, 'Visible count: ' || count(*)::text from portfolio_sync_runs
union all select 'approved_admin_reads_portfolio_snapshots', count(*) = 2, 'Visible count: ' || count(*)::text from portfolio_snapshots
union all select 'approved_admin_reads_portfolio_positions', count(*) = 2, 'Visible count: ' || count(*)::text from portfolio_positions
union all select 'approved_admin_reads_copilot_findings', count(*) = 2, 'Visible count: ' || count(*)::text from copilot_findings
union all select 'approved_admin_reads_copilot_reports', count(*) = 2, 'Visible count: ' || count(*)::text from copilot_reports;

reset role;

select * from copilot_rls_results order by check_name;

do $$
declare
  failures text;
begin
  select string_agg(check_name || ': ' || detail, E'\n' order by check_name)
  into failures
  from copilot_rls_results
  where not passed;

  if failures is not null then
    raise exception 'Copilot RLS verification failed:%', E'\n' || failures;
  end if;
end $$;

rollback;

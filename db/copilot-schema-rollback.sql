begin;

do $$
declare
  policy_pair record;
begin
  for policy_pair in
    select *
    from (
      values
        ('copilot_reports', 'copilot_reports_own_or_admin_read'),
        ('copilot_findings', 'copilot_findings_own_or_admin_read'),
        ('portfolio_positions', 'portfolio_positions_own_or_admin_read'),
        ('portfolio_snapshots', 'portfolio_snapshots_own_or_admin_read'),
        ('portfolio_sync_runs', 'portfolio_sync_runs_own_or_admin_read'),
        ('brokerage_accounts', 'brokerage_accounts_own_or_admin_read'),
        ('brokerage_connections', 'brokerage_connections_own_or_admin_read')
    ) as policy_pair(table_name, policy_name)
  loop
    if to_regclass('public.' || policy_pair.table_name) is not null then
      execute format('drop policy if exists %I on public.%I', policy_pair.policy_name, policy_pair.table_name);
    end if;
  end loop;
end $$;

drop table if exists copilot_reports;
drop table if exists copilot_findings;
drop table if exists portfolio_positions;
drop table if exists portfolio_snapshots;
drop table if exists portfolio_sync_runs;
drop table if exists brokerage_accounts;
drop table if exists brokerage_connections;

drop index if exists copilot_trade_history_id_user_id_uidx;

commit;

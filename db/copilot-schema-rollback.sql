drop policy if exists copilot_reports_own_or_admin_read on copilot_reports;
drop policy if exists copilot_findings_own_or_admin_read on copilot_findings;
drop policy if exists portfolio_positions_own_or_admin_read on portfolio_positions;
drop policy if exists portfolio_snapshots_own_or_admin_read on portfolio_snapshots;
drop policy if exists portfolio_sync_runs_own_or_admin_read on portfolio_sync_runs;
drop policy if exists brokerage_accounts_own_or_admin_read on brokerage_accounts;
drop policy if exists brokerage_connections_own_or_admin_read on brokerage_connections;

drop table if exists copilot_reports;
drop table if exists copilot_findings;
drop table if exists portfolio_positions;
drop table if exists portfolio_snapshots;
drop table if exists portfolio_sync_runs;
drop table if exists brokerage_accounts;
drop table if exists brokerage_connections;

drop index if exists trade_history_id_user_id_uidx;

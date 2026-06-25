create extension if not exists pgcrypto;

create type asset_type as enum ('stock', 'etf', 'crypto');
create type agent_run_status as enum ('queued', 'running', 'completed', 'failed');
create type alert_channel as enum ('sms', 'email', 'none');
create type alert_status as enum ('preview', 'queued', 'sent', 'failed');
create type calibration_confidence as enum ('low', 'medium', 'high');
create type risk_profile as enum ('conservative', 'balanced', 'aggressive');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused');
create type trade_status as enum ('planned', 'open', 'closed', 'cancelled');
create type user_role as enum ('customer', 'admin');

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text,
  role user_role not null default 'customer',
  stripe_customer_id text unique,
  phone text,
  risk_profile risk_profile not null default 'balanced',
  account_budget text not null default 'not_set' check (account_budget in ('not_set', 'under_1000', '1000_5000', '5000_25000', '25000_plus')),
  investing_experience text not null default 'beginner' check (investing_experience in ('beginner', 'intermediate', 'advanced')),
  position_size_preference text not null default 'small' check (position_size_preference in ('small', 'moderate', 'aggressive')),
  setup_preference text not null default 'balanced' check (setup_preference in ('steady', 'balanced', 'momentum')),
  minimum_confidence integer not null default 70 check (minimum_confidence between 0 and 100),
  max_risk_score integer not null default 65 check (max_risk_score between 0 and 100),
  morning_alerts_enabled boolean not null default true,
  alert_channel alert_channel not null default 'email',
  alert_time time not null default '08:30',
  timezone text not null default 'America/Chicago',
  email_verified_at timestamptz,
  email_unsubscribed_at timestamptz,
  terms_accepted_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table auth_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table admin_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  granted_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  asset_type asset_type not null,
  score integer not null check (score between 0 and 100),
  confidence integer not null check (confidence between 0 and 100),
  risk_score integer not null check (risk_score between 0 and 100),
  entry_low numeric(14, 2) not null check (entry_low > 0),
  entry_high numeric(14, 2) not null check (entry_high >= entry_low),
  target_price numeric(14, 2) not null check (target_price > 0),
  stop_loss numeric(14, 2) not null check (stop_loss > 0),
  expected_gain numeric(7, 2) not null,
  expected_loss numeric(7, 2) not null,
  holding_period_days integer not null check (holding_period_days > 0),
  explanation text not null,
  created_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  status agent_run_status not null default 'queued',
  source text not null default 'mock',
  universe_count integer not null default 0 check (universe_count >= 0),
  selected_count integer not null default 0 check (selected_count >= 0),
  market_regime text,
  summary text,
  data_quality jsonb not null default '{}'::jsonb,
  cost_estimate jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table opportunity_rankings (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  rank integer not null check (rank > 0),
  technical_score integer not null check (technical_score between 0 and 100),
  financial_score integer not null check (financial_score between 0 and 100),
  news_score integer not null check (news_score between 0 and 100),
  macro_score integer not null check (macro_score between 0 and 100),
  liquidity_score integer not null check (liquidity_score between 0 and 100),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  raw_composite_score integer not null default 0 check (raw_composite_score between 0 and 100),
  composite_score integer not null check (composite_score between 0 and 100),
  calibration_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (agent_run_id, rank),
  unique (agent_run_id, opportunity_id)
);

create table backtest_runs (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  windows_tested integer not null check (windows_tested > 0),
  trades_tested integer not null default 0 check (trades_tested >= 0),
  target_hit_rate numeric(6, 2) not null default 0,
  stop_hit_rate numeric(6, 2) not null default 0,
  expired_rate numeric(6, 2) not null default 0,
  average_return_pct numeric(7, 2) not null default 0,
  average_max_gain_pct numeric(7, 2) not null default 0,
  average_max_drawdown_pct numeric(7, 2) not null default 0,
  average_reward_risk_ratio numeric(7, 2) not null default 0,
  average_score numeric(6, 2) not null default 0,
  symbols text[] not null default '{}',
  score_bands jsonb not null default '[]'::jsonb,
  learning_summary text not null,
  openai_instruction text not null,
  notes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table backtest_trades (
  id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references backtest_runs(id) on delete cascade,
  as_of date not null,
  symbol text not null,
  rank integer not null check (rank > 0),
  score integer not null check (score between 0 and 100),
  confidence integer not null check (confidence between 0 and 100),
  risk_score integer not null check (risk_score between 0 and 100),
  entry_date date,
  entry_price numeric(14, 2) not null,
  target_price numeric(14, 2) not null,
  stop_loss numeric(14, 2) not null,
  reward_risk_ratio numeric(7, 2) not null default 0,
  holding_period_days integer not null check (holding_period_days > 0),
  outcome text not null check (outcome in ('target_hit', 'stop_hit', 'expired', 'no_data')),
  exit_date date,
  exit_price numeric(14, 2),
  return_pct numeric(7, 2) not null default 0,
  max_gain_pct numeric(7, 2) not null default 0,
  max_drawdown_pct numeric(7, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table ranking_calibration_rules (
  id uuid primary key default gen_random_uuid(),
  source_backtest_run_id uuid references backtest_runs(id) on delete set null,
  rule_key text not null,
  label text not null,
  description text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  trigger_description text not null,
  score_penalty integer not null default 0 check (score_penalty between 0 and 25),
  confidence_penalty integer not null default 0 check (confidence_penalty between 0 and 25),
  risk_adjustment integer not null default 0 check (risk_adjustment between 0 and 25),
  sample_size integer not null default 0 check (sample_size >= 0),
  target_hit_rate numeric(6, 2) not null default 0,
  stop_hit_rate numeric(6, 2) not null default 0,
  average_return_pct numeric(7, 2) not null default 0,
  confidence calibration_confidence not null default 'low',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan_key text not null,
  status subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table daily_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  rank integer not null check (rank > 0),
  pick_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, pick_date, opportunity_id),
  unique (user_id, pick_date, rank)
);

create table alert_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  agent_run_id uuid references agent_runs(id) on delete set null,
  channel alert_channel not null,
  status alert_status not null default 'preview',
  recipient text not null,
  message text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table email_link_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  alert_log_id uuid references alert_logs(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete set null,
  symbol text not null,
  tracking_id text not null,
  source text not null default 'morning_email',
  user_agent text,
  clicked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table alert_open_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  alert_log_id uuid references alert_logs(id) on delete set null,
  tracking_id text not null,
  source text not null default 'morning_email',
  user_agent text,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table app_event_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('info', 'warning', 'error')),
  source text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table customer_monthly_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  month_start date not null,
  email_link_clicks integer not null default 0 check (email_link_clicks >= 0),
  last_email_click_at timestamptz,
  top_symbols text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start)
);

create table watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (watchlist_id, opportunity_id)
);

create table trade_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  symbol text not null,
  asset_type asset_type not null,
  entry_price numeric(14, 2) not null check (entry_price > 0),
  exit_price numeric(14, 2) check (exit_price > 0),
  target_price numeric(14, 2) not null check (target_price > 0),
  stop_loss numeric(14, 2) not null check (stop_loss > 0),
  quantity numeric(18, 8) not null check (quantity > 0),
  status trade_status not null default 'planned',
  opened_at timestamptz,
  closed_at timestamptz,
  realized_gain numeric(14, 2),
  realized_loss numeric(14, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index opportunities_symbol_idx on opportunities(symbol);
create index opportunities_score_idx on opportunities(score desc);
create index opportunities_asset_type_idx on opportunities(asset_type);
create index users_role_idx on users(role);
create index users_alerts_idx on users(morning_alerts_enabled, alert_channel, email_unsubscribed_at);
create index auth_email_verification_tokens_user_idx on auth_email_verification_tokens(user_id);
create index auth_email_verification_tokens_active_idx on auth_email_verification_tokens(expires_at)
  where consumed_at is null;
create index agent_runs_status_idx on agent_runs(status);
create index agent_runs_started_at_idx on agent_runs(started_at desc);
create index opportunity_rankings_agent_run_id_idx on opportunity_rankings(agent_run_id);
create index opportunity_rankings_rank_idx on opportunity_rankings(rank);
create index backtest_runs_generated_at_idx on backtest_runs(generated_at desc);
create index backtest_trades_run_id_idx on backtest_trades(backtest_run_id);
create index backtest_trades_symbol_idx on backtest_trades(symbol);
create index ranking_calibration_rules_active_idx on ranking_calibration_rules(active);
create index ranking_calibration_rules_key_idx on ranking_calibration_rules(rule_key);
create index subscriptions_user_id_idx on subscriptions(user_id);
create index subscriptions_customer_id_idx on subscriptions(stripe_customer_id);
create index subscriptions_status_idx on subscriptions(status);
create index daily_picks_user_date_idx on daily_picks(user_id, pick_date desc);
create index alert_logs_user_id_idx on alert_logs(user_id);
create index alert_logs_status_idx on alert_logs(status);
create index email_link_events_user_clicked_idx on email_link_events(user_id, clicked_at desc);
create index email_link_events_tracking_id_idx on email_link_events(tracking_id);
create index alert_open_events_user_opened_idx on alert_open_events(user_id, opened_at desc);
create index alert_open_events_tracking_id_idx on alert_open_events(tracking_id);
create index app_event_logs_created_at_idx on app_event_logs(created_at desc);
create index app_event_logs_level_idx on app_event_logs(level);
create index customer_monthly_usage_user_month_idx on customer_monthly_usage(user_id, month_start desc);
create index watchlists_user_id_idx on watchlists(user_id);
create index watchlist_items_watchlist_id_idx on watchlist_items(watchlist_id);
create index trade_history_user_id_idx on trade_history(user_id);
create index trade_history_symbol_idx on trade_history(symbol);

alter table users enable row level security;
alter table auth_email_verification_tokens enable row level security;
alter table admin_access_grants enable row level security;
alter table opportunities enable row level security;
alter table agent_runs enable row level security;
alter table opportunity_rankings enable row level security;
alter table backtest_runs enable row level security;
alter table backtest_trades enable row level security;
alter table ranking_calibration_rules enable row level security;
alter table subscriptions enable row level security;
alter table daily_picks enable row level security;
alter table alert_logs enable row level security;
alter table email_link_events enable row level security;
alter table alert_open_events enable row level security;
alter table app_event_logs enable row level security;
alter table customer_monthly_usage enable row level security;
alter table watchlists enable row level security;
alter table watchlist_items enable row level security;
alter table trade_history enable row level security;

create or replace function current_app_user_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from users where auth_user_id = auth.uid() limit 1
$$;

create or replace function current_app_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from users
    where auth_user_id = auth.uid()
      and role = 'admin'
  )
$$;

create or replace function current_app_user_can_read_public_data()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated' or current_app_user_is_admin()
$$;

drop policy if exists users_select_own_or_admin on users;
create policy users_select_own_or_admin on users
for select using (id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists users_update_own on users;
create policy users_update_own on users
for update using (id = current_app_user_id()) with check (id = current_app_user_id());

drop policy if exists admin_access_grants_admin_all on admin_access_grants;
create policy admin_access_grants_admin_all on admin_access_grants
for all using (current_app_user_is_admin()) with check (current_app_user_is_admin());

drop policy if exists opportunities_authenticated_read on opportunities;
create policy opportunities_authenticated_read on opportunities
for select using (current_app_user_can_read_public_data());

drop policy if exists agent_runs_authenticated_read on agent_runs;
create policy agent_runs_authenticated_read on agent_runs
for select using (current_app_user_can_read_public_data());

drop policy if exists opportunity_rankings_authenticated_read on opportunity_rankings;
create policy opportunity_rankings_authenticated_read on opportunity_rankings
for select using (current_app_user_can_read_public_data());

drop policy if exists backtest_runs_admin_read on backtest_runs;
create policy backtest_runs_admin_read on backtest_runs
for select using (current_app_user_is_admin());

drop policy if exists backtest_trades_admin_read on backtest_trades;
create policy backtest_trades_admin_read on backtest_trades
for select using (current_app_user_is_admin());

drop policy if exists ranking_calibration_rules_admin_read on ranking_calibration_rules;
create policy ranking_calibration_rules_admin_read on ranking_calibration_rules
for select using (current_app_user_is_admin());

drop policy if exists subscriptions_own_or_admin_read on subscriptions;
create policy subscriptions_own_or_admin_read on subscriptions
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists daily_picks_own_or_admin_read on daily_picks;
create policy daily_picks_own_or_admin_read on daily_picks
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists alert_logs_own_or_admin_read on alert_logs;
create policy alert_logs_own_or_admin_read on alert_logs
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists email_link_events_own_or_admin_read on email_link_events;
create policy email_link_events_own_or_admin_read on email_link_events
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists alert_open_events_own_or_admin_read on alert_open_events;
create policy alert_open_events_own_or_admin_read on alert_open_events
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists app_event_logs_admin_read on app_event_logs;
create policy app_event_logs_admin_read on app_event_logs
for select using (current_app_user_is_admin());

drop policy if exists customer_monthly_usage_own_or_admin_read on customer_monthly_usage;
create policy customer_monthly_usage_own_or_admin_read on customer_monthly_usage
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists watchlists_own_select on watchlists;
create policy watchlists_own_select on watchlists
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists watchlists_own_insert on watchlists;
create policy watchlists_own_insert on watchlists
for insert with check (user_id = current_app_user_id());

drop policy if exists watchlists_own_update on watchlists;
create policy watchlists_own_update on watchlists
for update using (user_id = current_app_user_id()) with check (user_id = current_app_user_id());

drop policy if exists watchlists_own_delete on watchlists;
create policy watchlists_own_delete on watchlists
for delete using (user_id = current_app_user_id());

drop policy if exists watchlist_items_own_select on watchlist_items;
create policy watchlist_items_own_select on watchlist_items
for select using (
  current_app_user_is_admin()
  or exists (
    select 1 from watchlists
    where watchlists.id = watchlist_items.watchlist_id
      and watchlists.user_id = current_app_user_id()
  )
);

drop policy if exists watchlist_items_own_insert on watchlist_items;
create policy watchlist_items_own_insert on watchlist_items
for insert with check (
  exists (
    select 1 from watchlists
    where watchlists.id = watchlist_items.watchlist_id
      and watchlists.user_id = current_app_user_id()
  )
);

drop policy if exists watchlist_items_own_delete on watchlist_items;
create policy watchlist_items_own_delete on watchlist_items
for delete using (
  exists (
    select 1 from watchlists
    where watchlists.id = watchlist_items.watchlist_id
      and watchlists.user_id = current_app_user_id()
  )
);

drop policy if exists trade_history_own_select on trade_history;
create policy trade_history_own_select on trade_history
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists trade_history_own_insert on trade_history;
create policy trade_history_own_insert on trade_history
for insert with check (user_id = current_app_user_id());

drop policy if exists trade_history_own_update on trade_history;
create policy trade_history_own_update on trade_history
for update using (user_id = current_app_user_id()) with check (user_id = current_app_user_id());

drop policy if exists trade_history_own_delete on trade_history;
create policy trade_history_own_delete on trade_history
for delete using (user_id = current_app_user_id());

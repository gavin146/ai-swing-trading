create extension if not exists pgcrypto;

create type asset_type as enum ('stock', 'etf', 'crypto');
create type agent_run_status as enum ('queued', 'running', 'completed', 'failed');
create type alert_channel as enum ('sms', 'email', 'none');
create type alert_status as enum ('preview', 'queued', 'sent', 'failed');
create type risk_profile as enum ('conservative', 'balanced', 'aggressive');
create type trade_status as enum ('planned', 'open', 'closed', 'cancelled');

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text,
  phone text,
  risk_profile risk_profile not null default 'balanced',
  minimum_confidence integer not null default 70 check (minimum_confidence between 0 and 100),
  max_risk_score integer not null default 65 check (max_risk_score between 0 and 100),
  morning_alerts_enabled boolean not null default true,
  alert_channel alert_channel not null default 'sms',
  alert_time time not null default '07:30',
  timezone text not null default 'America/Chicago',
  created_at timestamptz not null default now()
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
  universe_count integer not null default 0 check (universe_count >= 0),
  selected_count integer not null default 0 check (selected_count >= 0),
  market_regime text,
  summary text,
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
  composite_score integer not null check (composite_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (agent_run_id, rank),
  unique (agent_run_id, opportunity_id)
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
  user_id uuid not null references users(id) on delete cascade,
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
create index agent_runs_status_idx on agent_runs(status);
create index agent_runs_started_at_idx on agent_runs(started_at desc);
create index opportunity_rankings_agent_run_id_idx on opportunity_rankings(agent_run_id);
create index opportunity_rankings_rank_idx on opportunity_rankings(rank);
create index daily_picks_user_date_idx on daily_picks(user_id, pick_date desc);
create index alert_logs_user_id_idx on alert_logs(user_id);
create index alert_logs_status_idx on alert_logs(status);
create index watchlists_user_id_idx on watchlists(user_id);
create index watchlist_items_watchlist_id_idx on watchlist_items(watchlist_id);
create index trade_history_user_id_idx on trade_history(user_id);
create index trade_history_symbol_idx on trade_history(symbol);

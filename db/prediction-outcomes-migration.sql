create table if not exists prediction_outcomes (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  symbol text not null,
  rank integer not null check (rank > 0),
  prediction_date date not null,
  score integer not null check (score between 0 and 100),
  confidence integer not null check (confidence between 0 and 100),
  risk_score integer not null check (risk_score between 0 and 100),
  entry_low numeric(14, 2) not null,
  entry_high numeric(14, 2) not null,
  target_price numeric(14, 2) not null,
  stop_loss numeric(14, 2) not null,
  expected_gain numeric(7, 2) not null,
  expected_loss numeric(7, 2) not null,
  reward_risk_ratio numeric(7, 2) not null default 0,
  holding_period_days integer not null check (holding_period_days > 0),
  status text not null default 'pending'
    check (status in ('pending', 'entered', 'target_hit', 'stop_hit', 'expired', 'no_entry', 'no_data')),
  entry_date date,
  entry_price numeric(14, 2),
  exit_date date,
  exit_price numeric(14, 2),
  return_pct numeric(7, 2) not null default 0,
  max_gain_pct numeric(7, 2) not null default 0,
  max_drawdown_pct numeric(7, 2) not null default 0,
  spy_return_pct numeric(7, 2),
  qqq_return_pct numeric(7, 2),
  benchmark_return_pct numeric(7, 2),
  excess_return_pct numeric(7, 2),
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_run_id, opportunity_id)
);

create index if not exists prediction_outcomes_date_idx on prediction_outcomes(prediction_date desc);
create index if not exists prediction_outcomes_status_idx on prediction_outcomes(status);
create index if not exists prediction_outcomes_symbol_idx on prediction_outcomes(symbol);
create index if not exists prediction_outcomes_run_idx on prediction_outcomes(agent_run_id);

alter table prediction_outcomes enable row level security;

drop policy if exists prediction_outcomes_admin_read on prediction_outcomes;
create policy prediction_outcomes_admin_read on prediction_outcomes
for select using (current_app_user_is_admin());

create table if not exists brokerage_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider_id text not null
    check (provider_id in ('manual_trade_history', 'mock_local', 'snaptrade', 'plaid_investments', 'broker_specific')),
  external_connection_id text,
  status text not null default 'not_connected'
    check (status in ('not_connected', 'instructions_ready', 'connected', 'reconnect_required', 'disabled', 'unhealthy', 'disconnected')),
  capabilities jsonb not null default '{"canPlaceOrders": false}'::jsonb
    check (
      jsonb_typeof(capabilities) = 'object'
      and coalesce(capabilities->>'canPlaceOrders', 'false') = 'false'
    ),
  last_sync_started_at timestamptz,
  last_synced_at timestamptz,
  data_as_of timestamptz,
  last_error_code text,
  last_error_message text check (last_error_message is null or length(last_error_message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (last_synced_at is null or last_sync_started_at is null or last_synced_at >= last_sync_started_at)
);

comment on table brokerage_connections is
  'Read-only Copilot brokerage connection metadata. Secrets, passwords, access tokens, refresh tokens, API keys, and raw provider credentials are intentionally absent.';
comment on column brokerage_connections.external_connection_id is
  'Opaque provider-side connection reference only. This must not store credentials, access tokens, refresh tokens, or secrets.';
comment on column brokerage_connections.capabilities is
  'Provider-neutral read capability flags. canPlaceOrders must remain false because SwingFi is research-only.';
comment on column brokerage_connections.last_error_message is
  'Sanitized provider error text only. Do not store raw provider responses or credential material.';

create unique index if not exists brokerage_connections_user_provider_external_uidx
  on brokerage_connections(user_id, provider_id, coalesce(external_connection_id, ''));
create index if not exists brokerage_connections_user_status_idx
  on brokerage_connections(user_id, status);
create index if not exists brokerage_connections_sync_idx
  on brokerage_connections(provider_id, status, last_synced_at desc);

create table if not exists brokerage_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  connection_id uuid not null,
  external_account_id text not null,
  display_name text not null check (length(display_name) between 1 and 160),
  masked_account_identifier text check (masked_account_identifier is null or length(masked_account_identifier) <= 32),
  account_type text not null default 'unknown'
    check (account_type in ('taxable', 'ira', 'roth_ira', 'crypto', 'unknown')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active'
    check (status in ('active', 'stale', 'disconnected', 'archived')),
  data_as_of timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (connection_id, user_id)
    references brokerage_connections(id, user_id)
    on delete cascade
);

comment on table brokerage_accounts is
  'Read-only normalized brokerage account metadata for Copilot. Account login credentials and tokens are intentionally absent.';
comment on column brokerage_accounts.external_account_id is
  'Opaque provider account reference. Do not store full account numbers or credentials.';
comment on column brokerage_accounts.masked_account_identifier is
  'Optional masked account display value only, such as the last four characters supplied by a provider.';

create unique index if not exists brokerage_accounts_connection_external_uidx
  on brokerage_accounts(connection_id, external_account_id);
create index if not exists brokerage_accounts_user_status_idx
  on brokerage_accounts(user_id, status);
create index if not exists brokerage_accounts_connection_idx
  on brokerage_accounts(connection_id);

create table if not exists portfolio_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  connection_id uuid not null,
  provider_sync_key text,
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  data_as_of timestamptz,
  account_count integer not null default 0 check (account_count >= 0),
  position_count integer not null default 0 check (position_count >= 0),
  error_code text,
  error_message text check (error_message is null or length(error_message) <= 1000),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (connection_id, user_id)
    references brokerage_connections(id, user_id)
    on delete cascade,
  check (completed_at is null or completed_at >= started_at)
);

comment on table portfolio_sync_runs is
  'Read-only portfolio sync audit runs for Copilot. Provider sync keys are idempotency references and must not contain credentials.';
comment on column portfolio_sync_runs.provider_sync_key is
  'Optional idempotency key or opaque provider run reference. This must not store secrets, raw tokens, or API keys.';
comment on column portfolio_sync_runs.error_message is
  'Sanitized sync error text only. Do not store raw provider responses or credential material.';

create unique index if not exists portfolio_sync_runs_connection_provider_key_uidx
  on portfolio_sync_runs(connection_id, provider_sync_key)
  where provider_sync_key is not null;
create index if not exists portfolio_sync_runs_user_started_idx
  on portfolio_sync_runs(user_id, started_at desc);
create index if not exists portfolio_sync_runs_connection_status_idx
  on portfolio_sync_runs(connection_id, status, started_at desc);

create table if not exists portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  connection_id uuid,
  account_id uuid,
  sync_run_id uuid,
  source_type text not null
    check (source_type in ('manual', 'brokerage', 'mock', 'imported')),
  total_value numeric(18, 2) check (total_value is null or total_value >= 0),
  cash_value numeric(18, 2) check (cash_value is null or cash_value >= 0),
  invested_value numeric(18, 2) check (invested_value is null or invested_value >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  completeness jsonb not null default '{}'::jsonb check (jsonb_typeof(completeness) = 'object'),
  status text not null default 'partial'
    check (status in ('empty', 'partial', 'complete', 'stale', 'failed')),
  data_as_of timestamptz not null,
  captured_at timestamptz not null default now(),
  source_hash text not null check (length(source_hash) between 8 and 128),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (connection_id, user_id)
    references brokerage_connections(id, user_id)
    on delete cascade,
  foreign key (account_id, user_id)
    references brokerage_accounts(id, user_id)
    on delete cascade,
  foreign key (sync_run_id, user_id)
    references portfolio_sync_runs(id, user_id)
    on delete cascade,
  check (captured_at >= data_as_of)
);

comment on table portfolio_snapshots is
  'Point-in-time normalized Copilot portfolio snapshots from manual, brokerage, mock, or imported read-only sources.';
comment on column portfolio_snapshots.source_hash is
  'Stable deduplication key generated from sanitized normalized source data. Do not include provider credentials or raw secrets in this hash input.';

create unique index if not exists portfolio_snapshots_user_source_hash_uidx
  on portfolio_snapshots(user_id, source_type, source_hash);
create index if not exists portfolio_snapshots_user_captured_idx
  on portfolio_snapshots(user_id, captured_at desc);
create index if not exists portfolio_snapshots_user_data_as_of_idx
  on portfolio_snapshots(user_id, data_as_of desc);
create index if not exists portfolio_snapshots_connection_idx
  on portfolio_snapshots(connection_id, captured_at desc);

create unique index if not exists trade_history_id_user_id_uidx
  on trade_history(id, user_id);

create table if not exists portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  snapshot_id uuid not null,
  account_id uuid,
  symbol text not null check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.-]{1,12}$'),
  asset_type text not null default 'stock'
    check (asset_type in ('stock', 'etf', 'crypto', 'unknown')),
  quantity numeric(24, 8) check (quantity is null or quantity >= 0),
  average_cost numeric(18, 4) check (average_cost is null or average_cost >= 0),
  market_price numeric(18, 4) check (market_price is null or market_price >= 0),
  market_value numeric(18, 2) check (market_value is null or market_value >= 0),
  unrealized_gain_loss numeric(18, 2),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source_position_id text,
  source_trade_history_id uuid,
  opportunity_id uuid references opportunities(id) on delete set null,
  data_as_of timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (snapshot_id, user_id)
    references portfolio_snapshots(id, user_id)
    on delete cascade,
  foreign key (account_id, user_id)
    references brokerage_accounts(id, user_id)
    on delete cascade,
  foreign key (source_trade_history_id, user_id)
    references trade_history(id, user_id)
    on delete cascade
);

comment on table portfolio_positions is
  'Read-only normalized Copilot positions from portfolio snapshots. Positions may link to SwingFi trade_history or opportunities without overwriting those original plans.';
comment on column portfolio_positions.source_position_id is
  'Opaque provider position reference. Do not store credentials, tokens, API secrets, or raw account identifiers.';

create unique index if not exists portfolio_positions_snapshot_symbol_source_uidx
  on portfolio_positions(snapshot_id, symbol, coalesce(source_position_id, ''));
create index if not exists portfolio_positions_user_symbol_idx
  on portfolio_positions(user_id, symbol);
create index if not exists portfolio_positions_snapshot_idx
  on portfolio_positions(snapshot_id);
create index if not exists portfolio_positions_account_idx
  on portfolio_positions(account_id);
create index if not exists portfolio_positions_trade_history_idx
  on portfolio_positions(source_trade_history_id);

create table if not exists copilot_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  account_id uuid,
  position_id uuid,
  symbol text check (symbol is null or (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.-]{1,12}$')),
  finding_type text not null
    check (
      finding_type in (
        'DATA_STALE',
        'QUOTE_UNAVAILABLE',
        'NO_ACTIVE_SWINGFI_PLAN',
        'NEAR_STOP',
        'BELOW_OR_AT_STOP',
        'NEAR_TARGET',
        'AT_OR_ABOVE_TARGET',
        'PROFIT_REVIEW_ZONE',
        'HOLDING_WINDOW_EXPIRING',
        'HOLDING_WINDOW_EXPIRED',
        'POSITION_CONCENTRATION',
        'SECTOR_CONCENTRATION',
        'EARNINGS_OR_EVENT_RISK',
        'FILING_OR_HEADLINE_RISK',
        'TREND_WEAKENING',
        'MOMENTUM_IMPROVING',
        'REMAINING_REWARD_RISK_WEAK',
        'INSIDE_ORIGINAL_PLAN'
      )
    ),
  severity text not null
    check (severity in ('info', 'attention', 'high')),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  message text not null check (length(message) between 1 and 1400),
  input_snapshot_id uuid,
  input_version text not null default 'portfolio-analyzer.v1',
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id)
    references brokerage_accounts(id, user_id)
    on delete cascade,
  foreign key (position_id, user_id)
    references portfolio_positions(id, user_id)
    on delete cascade,
  foreign key (input_snapshot_id, user_id)
    references portfolio_snapshots(id, user_id)
    on delete cascade
);

comment on table copilot_findings is
  'Deterministic Copilot review findings built from normalized portfolio snapshots and SwingFi research inputs. Evidence must be structured and sanitized.';
comment on column copilot_findings.message is
  'Review-oriented customer-safe message. Do not store direct order instructions or guaranteed-return claims.';

create index if not exists copilot_findings_user_created_idx
  on copilot_findings(user_id, created_at desc);
create index if not exists copilot_findings_user_symbol_idx
  on copilot_findings(user_id, symbol);
create index if not exists copilot_findings_snapshot_idx
  on copilot_findings(input_snapshot_id);
create index if not exists copilot_findings_position_idx
  on copilot_findings(position_id);

create table if not exists copilot_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  report_date date not null default current_date,
  portfolio_data_as_of timestamptz,
  structured_input jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_input) = 'object'),
  deterministic_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(deterministic_summary) = 'object'),
  narrative_text text,
  narrator_model text,
  prompt_version text,
  input_hash text not null check (length(input_hash) between 8 and 128),
  generation_status text not null default 'completed'
    check (generation_status in ('queued', 'running', 'completed', 'partial', 'failed')),
  error_code text,
  error_message text check (error_message is null or length(error_message) <= 1000),
  created_at timestamptz not null default now()
);

comment on table copilot_reports is
  'Generated Copilot report records using sanitized structured inputs and optional AI narration. Raw prompts, credentials, tokens, and provider secrets are intentionally absent.';
comment on column copilot_reports.structured_input is
  'Sanitized normalized input used for deterministic report generation. Do not store provider credentials, access tokens, refresh tokens, or API keys.';
comment on column copilot_reports.narrative_text is
  'Optional AI/deterministic narrative. It must explain evidence only and must not invent prices, quantities, account values, or trading instructions.';
comment on column copilot_reports.error_message is
  'Sanitized generation error text only. Do not store raw provider or model responses containing sensitive data.';

create unique index if not exists copilot_reports_user_date_input_uidx
  on copilot_reports(user_id, report_date, input_hash);
create index if not exists copilot_reports_user_created_idx
  on copilot_reports(user_id, created_at desc);
create index if not exists copilot_reports_user_report_date_idx
  on copilot_reports(user_id, report_date desc);
create index if not exists copilot_reports_status_idx
  on copilot_reports(generation_status, created_at desc);

alter table brokerage_connections enable row level security;
alter table brokerage_accounts enable row level security;
alter table portfolio_sync_runs enable row level security;
alter table portfolio_snapshots enable row level security;
alter table portfolio_positions enable row level security;
alter table copilot_findings enable row level security;
alter table copilot_reports enable row level security;

drop policy if exists brokerage_connections_own_or_admin_read on brokerage_connections;
create policy brokerage_connections_own_or_admin_read on brokerage_connections
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists brokerage_accounts_own_or_admin_read on brokerage_accounts;
create policy brokerage_accounts_own_or_admin_read on brokerage_accounts
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists portfolio_sync_runs_own_or_admin_read on portfolio_sync_runs;
create policy portfolio_sync_runs_own_or_admin_read on portfolio_sync_runs
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists portfolio_snapshots_own_or_admin_read on portfolio_snapshots;
create policy portfolio_snapshots_own_or_admin_read on portfolio_snapshots
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists portfolio_positions_own_or_admin_read on portfolio_positions;
create policy portfolio_positions_own_or_admin_read on portfolio_positions
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists copilot_findings_own_or_admin_read on copilot_findings;
create policy copilot_findings_own_or_admin_read on copilot_findings
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

drop policy if exists copilot_reports_own_or_admin_read on copilot_reports;
create policy copilot_reports_own_or_admin_read on copilot_reports
for select using (user_id = current_app_user_id() or current_app_user_is_admin());

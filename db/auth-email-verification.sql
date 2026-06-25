alter table users
  add column if not exists email_verified_at timestamptz;

update users
set email_verified_at = coalesce(email_verified_at, created_at, now())
where email_verified_at is null;

create table if not exists auth_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_email_verification_tokens_user_idx
  on auth_email_verification_tokens(user_id);

create index if not exists auth_email_verification_tokens_active_idx
  on auth_email_verification_tokens(expires_at)
  where consumed_at is null;

alter table auth_email_verification_tokens enable row level security;

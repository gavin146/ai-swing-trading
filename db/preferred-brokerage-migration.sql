alter table users
  add column if not exists preferred_brokerage text not null default 'none';

alter table users
  drop constraint if exists users_preferred_brokerage_check;

alter table users
  add constraint users_preferred_brokerage_check
  check (
    preferred_brokerage in (
      'none',
      'schwab',
      'fidelity',
      'robinhood',
      'etrade',
      'interactive_brokers',
      'other'
    )
  );

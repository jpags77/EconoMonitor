-- macro_entries table
create table macro_entries (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  date date not null,
  market_environment text not null,
  macro_score integer not null,
  trend_direction text not null,
  action_bias text not null,
  equities_score integer not null,
  bitcoin_score integer not null,
  gold_score integer not null,
  bonds_score integer not null,
  confidence text not null,
  drivers jsonb not null default '[]',
  headlines jsonb not null default '[]',
  raw_signals jsonb not null default '{}'
);

create index macro_entries_date_idx on macro_entries(date desc);

-- Row Level Security
alter table macro_entries enable row level security;

create policy "Allow public reads" on macro_entries
  for select using (true);

create policy "Allow public inserts" on macro_entries
  for insert with check (true);

-- Dashboard enhancements migration (2026-04-03)
alter table macro_entries add column if not exists key_metrics jsonb not null default '{}';
alter table macro_entries add column if not exists justification text not null default '';

-- Asset notes migration (2026-04-03)
alter table macro_entries add column if not exists asset_notes jsonb not null default '{}';

-- Flip card notes migration (2026-04-13)
alter table macro_entries add column if not exists macro_summary text not null default '';
alter table macro_entries add column if not exists action_notes text not null default '';

-- Three-features migration (2026-05-29)
-- schema_version: 1 = legacy 5-signal (inflation_oil), 2 = 6-signal (inflation + oil split)
alter table macro_entries add column if not exists schema_version integer not null default 1;
alter table macro_entries add column if not exists market_commentary text not null default '';

-- ML-ready flattened numeric view. v2 rows only (consistent 6-signal schema).
create or replace view daily_scores_v as
select
  date,
  schema_version,
  (raw_signals->>'real_yields')::int       as real_yields,
  (raw_signals->>'fed_expectations')::int  as fed_expectations,
  (raw_signals->>'inflation')::int         as inflation,
  (raw_signals->>'oil')::int               as oil,
  (raw_signals->>'dollar_dxy')::int        as dollar_dxy,
  (raw_signals->>'credit_stress')::int     as credit_stress,
  macro_score,
  (key_metrics->'sp500'->>'value')::numeric        as sp500,
  (key_metrics->'djia'->>'value')::numeric         as djia,
  (key_metrics->'nasdaq'->>'value')::numeric       as nasdaq,
  (key_metrics->'oil_wti'->>'value')::numeric      as oil_wti,
  (key_metrics->'gold'->>'value')::numeric         as gold,
  (key_metrics->'vix'->>'value')::numeric          as vix,
  (key_metrics->'treasury_10y'->>'value')::numeric as treasury_10y
from macro_entries
where schema_version = 2
order by date;

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

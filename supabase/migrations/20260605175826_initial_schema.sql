-- Summer Planner — initial schema.
-- Three tables: settings (one row per user), paychecks (~14 rows), expenses (many).
-- All amounts use numeric(12,2) for exact decimal — no float drift.
-- RLS enabled on every table; each user can only access their own rows.

create extension if not exists "pgcrypto";

create table public.settings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade unique,
  vault_cap                numeric(12,2) not null default 22858.00,
  usc_gross_baseline       numeric(12,2) not null default 1760.00,
  ntt_hourly_rate          numeric(12,2) not null default 30.00,
  usc_net_pct              numeric(7,6)  not null default 0.902088,
  ntt_net_pct              numeric(7,6)  not null default 0.926647,
  rent_monthly             numeric(12,2) not null default 812.25,
  rent_months              int           not null default 3,
  robinhood_weekly         numeric(12,2) not null default 100.00,
  usc_no_rent_vault        numeric(12,2) not null default 1080.00,
  usc_rent_vault           numeric(12,2) not null default 600.00,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.paychecks (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  pay_num                  int  not null,
  pay_date                 date not null,
  employer                 text not null check (employer in ('USC On-Campus', 'Colorado Internship')),
  hours_worked             numeric(7,2),
  ot_hours                 numeric(7,2)  not null default 0,
  actual_net_wages         numeric(12,2),
  per_diem                 numeric(12,2) not null default 0,
  extra_deposit            numeric(12,2) not null default 0,
  vault_override           numeric(12,2),
  rent_paid                numeric(12,2) not null default 0,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique(user_id, pay_num)
);

create index paychecks_user_date_idx on public.paychecks (user_id, pay_date);

create table public.expenses (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  expense_date             date not null,
  description              text not null,
  amount                   numeric(12,2) not null,
  category                 text,
  created_at               timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, expense_date);

alter table public.settings  enable row level security;
alter table public.paychecks enable row level security;
alter table public.expenses  enable row level security;

create policy "settings_own"  on public.settings  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "paychecks_own" on public.paychecks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses_own"  on public.expenses  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger settings_updated_at  before update on public.settings  for each row execute function public.update_updated_at_column();
create trigger paychecks_updated_at before update on public.paychecks for each row execute function public.update_updated_at_column();

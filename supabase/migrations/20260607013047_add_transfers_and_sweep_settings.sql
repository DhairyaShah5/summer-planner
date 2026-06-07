-- Transfers between accounts (Chase -> BofA, etc).
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transferred_at date not null default current_date,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null default 'manual' check (kind in ('manual','rollover_sweep','per_diem_to_bofa','ot_to_bofa')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.transfers enable row level security;

create policy "transfers_select_own" on public.transfers
  for select using (auth.uid() = user_id);
create policy "transfers_insert_own" on public.transfers
  for insert with check (auth.uid() = user_id);
create policy "transfers_update_own" on public.transfers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transfers_delete_own" on public.transfers
  for delete using (auth.uid() = user_id);

create index transfers_user_id_idx on public.transfers (user_id);
create index transfers_transferred_at_idx on public.transfers (transferred_at);
create index transfers_kind_idx on public.transfers (kind);

-- Rollover sweep settings.
alter table public.settings
  add column if not exists rollover_sweep_threshold numeric(10,2) not null default 500,
  add column if not exists rollover_sweep_cushion numeric(10,2) not null default 250;

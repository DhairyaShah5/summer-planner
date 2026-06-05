create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('checking','credit_card','hysa')),
  current_balance numeric(12,2) not null default 0,
  is_paycheck_destination boolean not null default false,
  is_vault         boolean not null default false,
  display_order    int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index accounts_user_idx on public.accounts (user_id, display_order);

alter table public.expenses add column account_id uuid references public.accounts(id) on delete set null;

alter table public.accounts enable row level security;
create policy "accounts_own" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger accounts_updated_at before update on public.accounts for each row execute function public.update_updated_at_column();

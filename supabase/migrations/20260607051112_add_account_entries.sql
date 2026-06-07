-- Free-form per-account log used by the Accounts ledger modal.
-- amount is SIGNED: positive = money in, negative = money out.
-- These entries are intentionally NOT shown on the Expenses page
-- because they cover non-personal flows (upcoming BofA bills, etc.).
create table public.account_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  dated_at date not null default current_date,
  amount numeric(12,2) not null,
  description text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.account_entries enable row level security;

create policy "account_entries_select_own" on public.account_entries
  for select using (auth.uid() = user_id);
create policy "account_entries_insert_own" on public.account_entries
  for insert with check (auth.uid() = user_id);
create policy "account_entries_update_own" on public.account_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "account_entries_delete_own" on public.account_entries
  for delete using (auth.uid() = user_id);

create index account_entries_user_id_idx on public.account_entries (user_id);
create index account_entries_account_id_idx on public.account_entries (account_id);
create index account_entries_dated_at_idx on public.account_entries (dated_at);

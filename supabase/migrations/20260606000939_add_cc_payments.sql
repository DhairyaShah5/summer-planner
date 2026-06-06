create table public.cc_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  paid_at         date not null default current_date,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id   uuid not null references public.accounts(id) on delete restrict,
  amount          numeric(12,2) not null check (amount > 0),
  note            text,
  created_at      timestamptz not null default now()
);

create index cc_payments_user_date_idx on public.cc_payments (user_id, paid_at);

alter table public.cc_payments enable row level security;
create policy "cc_payments_own" on public.cc_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

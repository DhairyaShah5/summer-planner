-- Lenders: money the user has borrowed and still owes.
--   principal   = original amount borrowed (fixed reference)
--   outstanding = remaining balance owed (shrinks as user pays back)
-- Goal detection subtracts sum(outstanding) from the vault so Mission
-- Accomplished can't fire while there's still money owed to a friend.
create table public.lenders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  principal    numeric(12,2) not null default 0,
  outstanding  numeric(12,2) not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index lenders_user_idx on public.lenders (user_id);

alter table public.lenders enable row level security;

create policy "lenders_own" on public.lenders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

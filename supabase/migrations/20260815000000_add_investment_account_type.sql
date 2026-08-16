-- Allow 'investment' as an account type (Robinhood, brokerages, etc.).
alter table public.accounts
  drop constraint if exists accounts_type_check;

alter table public.accounts
  add constraint accounts_type_check
  check (type in ('checking','credit_card','hysa','investment'));

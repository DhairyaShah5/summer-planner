-- Per-account flag controlling whether the account participates in the
-- 3 net-worth hero cards on the Accounts page. Defaults to true so existing
-- accounts keep their current behavior.
alter table public.accounts
  add column if not exists include_in_net_worth boolean not null default true;

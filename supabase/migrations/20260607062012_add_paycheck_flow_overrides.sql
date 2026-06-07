-- Per-paycheck date overrides for the auto-derived vault / rent / robinhood
-- entries shown in the Account Ledger modal. Keys are kind strings:
--   { "vault": "2026-05-28", "rent": "2026-05-31", "robinhood": "2026-05-30" }
-- Missing keys fall back to the paycheck's pay_date. JSONB so adding new
-- override kinds later costs no migrations.
alter table public.paychecks
  add column if not exists flow_overrides jsonb not null default '{}'::jsonb;

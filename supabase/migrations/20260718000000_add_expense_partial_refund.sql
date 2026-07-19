-- Partial refunds on expenses (e.g. credit-card statement credits).
-- refund_expected: amount that will (or already has) come back on the same
-- card. Subtracted from `amount` when computing CO-budget effective spend.
-- refund_settled: false while pending, true once the refund actually cleared.
alter table public.expenses
  add column if not exists refund_expected numeric(10,2),
  add column if not exists refund_settled boolean not null default false;

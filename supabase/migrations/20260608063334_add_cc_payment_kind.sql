-- Kind of credit-card payment:
--   'payment'      - normal payoff. Source checking -> CC outstanding both
--                    drop by the amount. Existing behavior.
--   'refund_claim' - the CC has a credit balance (outstanding < 0) and the
--                    user requested the bank to ACH the credit back to their
--                    checking. Source checking RISES and CC outstanding
--                    RISES toward 0 by the amount.
alter table public.cc_payments
  add column if not exists kind text not null default 'payment'
    check (kind in ('payment','refund_claim'));

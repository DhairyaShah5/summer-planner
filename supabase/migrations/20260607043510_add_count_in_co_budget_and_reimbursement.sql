-- Flag for expenses that exist in real life (and update account balances)
-- but should NOT count toward the CO spending budget. Default true so existing
-- expenses keep their current behavior.
alter table public.expenses
  add column if not exists count_in_co_budget boolean not null default true;

-- Non-taxable reimbursement amount on a paycheck row (e.g. SAP Concur metro
-- pass refund). Lands in Chase Checking. Does NOT route to BofA, does NOT
-- affect Net%, vault, CO, rent, RH, or BofA overflow.
alter table public.paychecks
  add column if not exists reimbursement numeric(10,2) not null default 0
  check (reimbursement >= 0);

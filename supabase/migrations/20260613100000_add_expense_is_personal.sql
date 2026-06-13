-- Add is_personal flag to expenses to distinguish "off-budget personal"
-- (e.g. a leisure trip the user paid for) from "reimbursable" (will be paid
-- back). Both still hit count_in_co_budget = false so neither enters the CO
-- budget gate; the flag is purely intent / display.
--
-- Backfill: existing rows that were off-budget were tagged as reimbursable
-- in the prior single-toggle UI; we leave them as is_personal = false so
-- their meaning is preserved.

alter table public.expenses
  add column is_personal boolean not null default false;

alter table public.expenses
  add constraint expenses_is_personal_implies_off_budget
  check (
    is_personal = false or count_in_co_budget = false
  );

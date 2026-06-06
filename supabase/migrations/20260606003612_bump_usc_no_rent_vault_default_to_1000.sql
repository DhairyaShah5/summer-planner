-- Bump usc_no_rent_vault default from $900 to $1,000 so the schedule totals exactly $20k
-- after the cap throttle absorbs the +$400 on the last NTT check (Aug 28).
-- Existing user rows were already PATCHed via REST; this aligns the DB default for
-- new rows and Reset-to-Defaults behavior.
alter table public.settings alter column usc_no_rent_vault set default 1000.00;

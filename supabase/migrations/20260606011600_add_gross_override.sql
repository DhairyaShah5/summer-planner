-- Optional per-row gross override. Used for one-off checks whose gross differs
-- from the standard baseline (e.g., May 27 USC was $1,820 due to a different
-- hourly rate window — not OT, just a non-standard period).
alter table public.paychecks add column gross_override numeric(12,2);

update public.paychecks
   set gross_override = 1820.00
 where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158'
   and pay_num = 1;

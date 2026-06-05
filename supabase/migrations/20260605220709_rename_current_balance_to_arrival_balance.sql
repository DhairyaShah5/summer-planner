alter table public.accounts rename column current_balance to arrival_balance;
comment on column public.accounts.arrival_balance is 'Snapshot balance at the start of the summer (manually set once). Current balance is computed dynamically from received paychecks + expenses.';

-- Re-seed reasonable arrival values for user ffc67efd-1c09-483f-942b-c7ce6084d158:
-- Chase Checking: today $1,096.53 - net inflows $2,114.39 + rent $812.25 + RH $200 + vault transfer $600 = $594.39
-- Chase CC: today $311.16 outstanding - sum of seeded expenses $259.82 = $51.34
-- BofA Checking: no activity → $2,608.30
-- BofA CC: $0
-- Marcus HYSA: today $2,600 - $2,000 Q6 extra - $600 vault from May 27 = $0
update public.accounts set arrival_balance = 594.39  where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158' and name = 'Chase Checking';
update public.accounts set arrival_balance = 51.34   where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158' and name = 'Chase Credit Card';
update public.accounts set arrival_balance = 2608.30 where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158' and name = 'BofA Checking';
update public.accounts set arrival_balance = 0       where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158' and name = 'BofA Credit Card';
update public.accounts set arrival_balance = 0       where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158' and name = 'Marcus HYSA (Tuition Vault)';

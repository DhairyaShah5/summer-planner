alter table public.settings add column ntt_vault_default numeric(12,2) not null default 2100.00;
alter table public.settings alter column usc_no_rent_vault set default 900.00;

-- For user ffc67efd-1c09-483f-942b-c7ce6084d158:
update public.settings
   set usc_no_rent_vault = 900.00,
       ntt_vault_default = 2100.00
 where user_id = 'ffc67efd-1c09-483f-942b-c7ce6084d158';

alter table public.paychecks add column received boolean not null default false;

update public.paychecks set received = true where actual_net_wages is not null;

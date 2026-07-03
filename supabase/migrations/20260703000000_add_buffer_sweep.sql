-- Buffer sweep: symmetrical to the BofA rollover sweep, but for the Chase
-- buffer (sub-$100 wage remainders + reimbursement residuals). When the
-- accumulated buffer crosses `buffer_sweep_threshold`, the Weekly Tracker
-- suggests moving the excess (minus `buffer_sweep_cushion`) into Marcus HYSA
-- so the residual doesn't just idle in Chase.

alter table public.settings
  add column if not exists buffer_sweep_threshold numeric(10,2) not null default 500,
  add column if not exists buffer_sweep_cushion numeric(10,2) not null default 200;

-- Extend transfers.kind CHECK constraint to allow 'buffer_sweep'.
alter table public.transfers
  drop constraint if exists transfers_kind_check;

alter table public.transfers
  add constraint transfers_kind_check
  check (
    kind in (
      'manual',
      'rollover_sweep',
      'per_diem_to_bofa',
      'ot_to_bofa',
      'vault_topup_sweep',
      'buffer_sweep'
    )
  );

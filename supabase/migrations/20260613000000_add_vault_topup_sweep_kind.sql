-- Extend transfers.kind CHECK constraint to allow 'vault_topup_sweep'.
-- Used by the Dashboard's BofA-wages-to-Vault top-up banner.

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
      'vault_topup_sweep'
    )
  );

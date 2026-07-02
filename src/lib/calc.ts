/**
 * Pure TypeScript port of the Summer Planner allocation formulas.
 *
 * Allocation philosophy (post-2026-06 refactor):
 *   - All wage allocations (vault, CO Spend, OT-excess overflow) are multiples
 *     of $100.
 *   - Vault is SCHEDULED - it does not grow with overtime. The NTT vault target
 *     is `settings.nttVaultDefault` regardless of how big the actual check is;
 *     the USC vault target is `settings.uscNoRentVault` (or `uscRentVault` on
 *     a rent month).
 *   - Any pay above the no-OT projection (`expectedNoOT`) is "OT-driven excess"
 *     and routes to BofA Checking, NOT to vault or CO.
 *   - Per Diem (non-taxable NTT reimbursement) is treated as pure savings
 *     overflow: the entire perDiem amount flows straight through Chase to
 *     BofA Checking. It does NOT boost CO Spend - CO Spend is wage-funded only.
 *   - The cents/sub-$100 wage remainder lands in Buffer (still in Chase).
 *
 * Status (Received vs Pending) is driven by an explicit `received` flag on
 * each row, NOT inferred from actualNetWages. This avoids the bug where typing
 * `0` for actual net would flip the row to Received and still allocate the
 * full baseline vault, leaving no money for rent / RH / CO.
 */

export type Employer = 'USC On-Campus' | 'Colorado Internship'

export interface Settings {
  vaultCap: number
  uscGrossBaseline: number
  nttHourlyRate: number
  uscNetPct: number
  nttNetPct: number
  rentMonthly: number
  rentMonths: number
  robinhoodWeekly: number
  uscNoRentVault: number
  uscRentVault: number
  nttVaultDefault: number
}

export interface PaycheckInput {
  payNum: number
  payDate: Date | string
  employer: Employer
  hoursWorked: number | null
  otHours: number
  actualNetWages: number | null
  perDiem: number
  extraDeposit: number
  reimbursement: number
  vaultOverride: number | null
  /** Optional per-row gross override (one-off non-standard pay periods). */
  grossOverride: number | null
  rentPaid: number
  /** ISO date the rent leaves Chase. If null, defaults to the 1st of the
   *  month following payDate. Decouples rent from paycheck date so Chase
   *  reflects cash that's still sitting until rent is actually paid. */
  rentDateOverride?: string | null
  /** Locks this row's CO Spend allocation to a fixed dollar amount, ignoring
   *  the netPct-derived formula. Any residual (from wages that would have
   *  landed in CO but didn't) falls into buffer / stays in Chase. Used to
   *  freeze CO budgets after a W-2/netPct change so future setting shifts
   *  don't retroactively move planned CO amounts. Null = derive as before. */
  coOverride?: number | null
  /** Locks this row's total BofA overflow transfer amount (wage excess +
   *  per-diem passthrough combined) to a fixed dollar figure. Used when the
   *  actual transfer already happened at a value that differs from what the
   *  current settings would recompute. Null = derive as before. */
  bofaOverride?: number | null
  received: boolean
}

export interface PaycheckComputed extends PaycheckInput {
  gross: number
  netPct: number
  estimatedNet: number
  /** Projected net assuming no overtime - the "scheduled" check size. */
  expectedNoOT: number
  robinhood: number
  vault: number
  co: number
  /** OT-driven excess routed to BofA Checking (multiple of $100). */
  bofaOverflow: number
  buffer: number
  status: 'Received' | 'Pending'
  cumulativeVault: number
}

/** Floor `x` to the nearest multiple of 10 (legacy helper, kept for callers). */
export function floor10(x: number): number {
  return Math.floor(x / 10) * 10
}

/** Floor `x` to the nearest multiple of 100. */
export function floor100(x: number): number {
  return Math.floor(x / 100) * 100
}

/** Date the planner switches from paycheck-derived Robinhood to weekly
 *  Robinhood. Entries dated before this stay attached to their USC paycheck
 *  (so the existing user-edited Robinhood week 1/2 rows are preserved);
 *  on/after this date, Robinhood drains $robinhoodWeekly from Chase every
 *  Monday, independent of when paychecks actually arrive. */
export const RH_WEEKLY_CUTOVER = '2026-06-08'

/** Last day the weekly Robinhood schedule is generated through (internship end). */
export const INTERNSHIP_END = '2026-08-31'

/** Default rent payment date for a paycheck: 1st of the month FOLLOWING
 *  payDate. e.g. Jun 24 paycheck → rent leaves on Jul 1.  Centralizes the
 *  "rent doesn't actually leave Chase until next month" rule used by both
 *  computeAccountStates and the ledger display. */
export function defaultRentDate(payDateISO: string): string {
  const [y, m] = payDateISO.split('-').map(Number)
  const year = y ?? 2026
  const month = m ?? 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
}

/** Inclusive list of every Monday on/after `startISO` and on/before `endISO`,
 *  as YYYY-MM-DD strings. Parses input as local midnight so DST offsets
 *  can't shift a boundary date. */
export function mondaysBetween(startISO: string, endISO: string): string[] {
  const parse = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  }
  const fmt = (d: Date): string => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const cur = parse(startISO)
  const end = parse(endISO)
  // 1=Mon, 0=Sun, 6=Sat. Advance to first Monday on/after start.
  const dow = cur.getDay()
  const offset = dow === 1 ? 0 : (8 - dow) % 7
  cur.setDate(cur.getDate() + offset)
  const out: string[] = []
  while (cur <= end) {
    out.push(fmt(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

/**
 * Compute one paycheck row given the previous cumulative vault balance.
 * Threading prevCumulative through computeAll yields the full ledger.
 *
 * NOTE on reimbursement: `reimbursement` is a tax-free pass-through inflow
 * to Chase Checking only (e.g. SAP Concur metro pass refund). It's invisible
 * to vault, CO, RH, BofA overflow, and netPct, but it DOES land in `buffer`
 * so the Chase remainder accounts for it (and can go negative when transfers
 * out exceed wages + reimbursement).
 */
export function computeRow(
  prevCumulative: number,
  input: PaycheckInput,
  settings: Settings,
): PaycheckComputed {
  const {
    employer,
    hoursWorked,
    otHours,
    actualNetWages,
    perDiem,
    extraDeposit,
    reimbursement,
    vaultOverride,
    grossOverride,
    rentPaid,
    coOverride,
    bofaOverride,
    received,
  } = input

  // 1. Gross (actual, with OT). Per-row grossOverride wins when set -
  //    use it as both gross and expectedNoOTGross since it represents
  //    the actual full-period gross for this specific check.
  let gross: number
  let expectedNoOTGross: number
  if (grossOverride != null) {
    gross = grossOverride
    expectedNoOTGross = grossOverride
  } else if (employer === 'USC On-Campus') {
    gross = settings.uscGrossBaseline
    expectedNoOTGross = settings.uscGrossBaseline
  } else {
    const hours = hoursWorked ?? 0
    gross = hours * settings.nttHourlyRate + otHours * settings.nttHourlyRate * 1.5
    expectedNoOTGross = hours * settings.nttHourlyRate
  }

  // 3. Net %
  // Use observed net% only if the row is received AND we have an actual figure;
  // otherwise fall back to the projection rate.
  let netPct: number
  if (received && actualNetWages != null && gross > 0) {
    netPct = actualNetWages / gross
  } else {
    netPct = employer === 'USC On-Campus' ? settings.uscNetPct : settings.nttNetPct
  }

  // 4. Estimated Net (projection from actual gross)
  const estimatedNet = gross * netPct

  // 5. Expected no-OT net - the "scheduled" check size used to detect OT excess.
  //    Always projects using the settings default rate (never the observed rate),
  //    so a high-tax-bracket actual paycheck doesn't pull this down.
  const expectedNoOTNetPct =
    employer === 'USC On-Campus' ? settings.uscNetPct : settings.nttNetPct
  const expectedNoOT = expectedNoOTGross * expectedNoOTNetPct

  // 6. Base net used downstream:
  //    received && actualNetWages != null → use actual
  //    otherwise                          → use the projection
  const baseNet =
    received && actualNetWages != null ? actualNetWages : estimatedNet

  // 7-8. OT-driven excess routes to BofA, not vault/CO. usableNet is what we
  //      allocate against (capped at the scheduled no-OT check).
  const excess = Math.max(0, baseNet - expectedNoOT)
  const usableNet = baseNet - excess

  // 9. Robinhood
  const robinhood =
    employer === 'USC On-Campus' ? settings.robinhoodWeekly * 2 : 0

  // 10. Vault target - manual override, else employer-specific schedule
  let vaultTarget: number
  if (vaultOverride != null) {
    vaultTarget = Math.max(0, vaultOverride)
  } else if (employer === 'USC On-Campus') {
    vaultTarget = rentPaid > 0 ? settings.uscRentVault : settings.uscNoRentVault
  } else {
    vaultTarget = settings.nttVaultDefault
  }

  // 11. Vault available - actual money left after rent + RH, floored to $100.
  //     We use baseNet (full actual/projected) here, NOT usableNet - the scheduled
  //     vault contribution is meant to come from real money in the check, not
  //     just the no-OT expected portion. (Excess money still flows to BofA below.)
  const vaultAvailable = floor100(
    Math.max(0, baseNet - rentPaid - robinhood),
  )

  // 12. Vault cap room
  const vaultCapRoom = Math.max(
    0,
    settings.vaultCap - prevCumulative - extraDeposit,
  )

  // 13. Vault - pick the most restrictive limit, then floor100 for override safety
  const vault = floor100(Math.min(vaultTarget, vaultAvailable, vaultCapRoom))

  // 14. CO Spend - what's left of usableNet after vault/rent/RH, floored
  //     to $100. Per diem is NOT included here - it's pure savings overflow,
  //     not a CO budget booster (see step 15). coOverride locks the amount
  //     when set (freezes the CO plan against future netPct drift).
  const co =
    coOverride != null
      ? Math.max(0, coOverride)
      : floor100(Math.max(0, usableNet - vault - rentPaid - robinhood))

  // 15. BofA overflow - OT-driven excess (floored to $100) plus the full
  //     per diem amount (untouched, since per diem lands as a clean
  //     daily-rate multiple and isn't subject to the $100 wage rounding).
  //     Both pass through Chase and land in BofA the same day the paycheck
  //     hits. bofaOverride locks the total transfer amount when set - useful
  //     when the actual sweep happened before a settings change would have
  //     recomputed a different figure.
  const bofaOverflow =
    bofaOverride != null
      ? Math.max(0, bofaOverride)
      : floor100(excess) + perDiem

  // 16. Buffer - what actually stays in Chase from this paycheck once all
  //     transfers clear. Per diem nets to zero (added as income, fully
  //     removed via bofaOverflow). Reimbursement lands here as a pass-through
  //     inflow. Can go negative when vault/RH/BofA together exceed the
  //     paycheck's inflows - that surfaces an over-allocated check instead
  //     of silently clamping the shortfall to zero.
  const buffer =
    baseNet + perDiem + reimbursement - vault - rentPaid - robinhood - co - bofaOverflow

  // 17. Status - driven by the explicit `received` flag only.
  const status: 'Received' | 'Pending' = received ? 'Received' : 'Pending'

  // 18. Cumulative Vault
  const cumulativeVault = Math.min(
    settings.vaultCap,
    prevCumulative + extraDeposit + vault,
  )

  return {
    ...input,
    gross,
    netPct,
    estimatedNet,
    expectedNoOT,
    robinhood,
    vault,
    co,
    bofaOverflow,
    buffer,
    status,
    cumulativeVault,
  }
}

/**
 * Compute every paycheck in order, threading the cumulative vault forward.
 */
export function computeAll(
  inputs: PaycheckInput[],
  settings: Settings,
): PaycheckComputed[] {
  const out: PaycheckComputed[] = []
  let prevCumulative = 0
  for (const input of inputs) {
    const row = computeRow(prevCumulative, input, settings)
    out.push(row)
    prevCumulative = row.cumulativeVault
  }
  return out
}

/**
 * Account-state derivation: turn arrival balances + paychecks + expenses
 * into "current" (to-date) and "projected" (full-summer) live balances.
 *
 * The paycheck destination (Chase Checking) sees the bulk of the net wage
 * land, then bleeds out to vault (HYSA), rent (landlord), Robinhood,
 * extraDeposit (HYSA), and BofA overflow (BofA Checking). The vault account
 * is the inflow side of the vault/extra transfers. BofA Checking receives
 * the OT-driven overflow. Other accounts (credit cards) get no paycheck
 * flows - only expense activity.
 *
 * For expenses: checking/hysa accounts have the amount subtracted;
 * credit cards have it added (the outstanding balance grows).
 *
 * Today's date is computed once at call time; "to-date" includes any
 * paycheck/expense whose date is on or before today.
 */
export interface AccountInput {
  id: string
  name: string
  type: 'checking' | 'credit_card' | 'hysa'
  arrival_balance: number
  is_paycheck_destination: boolean
  is_vault: boolean
  display_order: number
}

export interface ExpenseInput {
  id: string
  expense_date: string
  amount: number
  account_id: string | null
}

export type CCPaymentKind = 'payment' | 'refund_claim'

export interface CCPaymentInput {
  id: string
  paid_at: string
  from_account_id: string
  to_account_id: string
  amount: number
  /** 'payment' (default) drains the from-account and reduces CC outstanding
   *  (paying down debt). 'refund_claim' flows the other way: the from-
   *  account (checking) RISES and the CC outstanding RISES toward 0 —
   *  used when the bank ACHes a credit balance back to your checking. */
  kind?: CCPaymentKind
}

export interface TransferInput {
  id: string
  transferred_at: string
  from_account_id: string
  to_account_id: string
  amount: number
  kind:
    | 'manual'
    | 'rollover_sweep'
    | 'per_diem_to_bofa'
    | 'ot_to_bofa'
    | 'vault_topup_sweep'
}

export interface AccountEntryInput {
  id: string
  account_id: string
  dated_at: string
  amount: number
  description: string
}

export interface AccountState {
  account: AccountInput
  arrival: number
  /** arrival + activity through today (received paychecks, dated expenses) */
  current: number
  /** arrival + activity for the full summer (all paychecks, all known expenses) */
  projected: number
}

// Chase holds per diem + OT until a transfer is logged, so its "current"
// balance includes those amounts until the user records moving them out.
// The remainingExpectedBofaTransfer term ensures projected balances still
// net out to the full-summer model regardless of how much has been swept.
//
// NOTE on reimbursement: each row's `reimbursement` is added to the Chase
// (paycheck-destination) account only - to `toDate` if the row is received,
// and always to `fullSummer`. It never touches BofA, Marcus HYSA, or any
// credit card flow, and is excluded from every allocation in computeRow.
export function computeAccountStates(
  accounts: AccountInput[],
  paychecks: PaycheckInput[],
  expenses: ExpenseInput[],
  settings: Settings,
  ccPayments: CCPaymentInput[] = [],
  transfers: TransferInput[] = [],
  accountEntries: AccountEntryInput[] = [],
  todayISO?: string,
): AccountState[] {
  const computed = computeAll(paychecks, settings)
  // Caller passes the user-timezone today (YYYY-MM-DD) when available so
  // a Sunday 11pm local edit doesn't flip the week. Falls back to UTC for
  // legacy callers / client-side use.
  const today = todayISO ?? new Date().toISOString().slice(0, 10)

  // Temporary heuristic: BofA Checking is matched by name. Replace with a
  // dedicated `is_overflow_destination` column once schema permits.
  const bofaAccount = accounts.find((a) => a.name === 'BofA Checking')
  const chaseAccount = accounts.find((a) => a.is_paycheck_destination)

  const totalExpectedBofaTransfer = computed.reduce(
    (sum, r) => sum + r.bofaOverflow,
    0,
  )
  const totalLoggedChaseToBofa =
    chaseAccount && bofaAccount
      ? transfers
          .filter(
            (t) =>
              t.from_account_id === chaseAccount.id &&
              t.to_account_id === bofaAccount.id,
          )
          .reduce((sum, t) => sum + t.amount, 0)
      : 0
  const remainingExpectedBofaTransfer = Math.max(
    0,
    totalExpectedBofaTransfer - totalLoggedChaseToBofa,
  )

  return accounts.map((account) => {
    const arrival = account.arrival_balance
    let toDate = 0
    let fullSummer = 0

    // --- Paycheck-driven flows ---
    const isBofaOverflow = bofaAccount?.id === account.id

    if (account.is_paycheck_destination) {
      // Paycheck destination (e.g. Chase Checking).
      // baseNet + perDiem hits checking, then vault + rent + RH leave it.
      // bofaOverflow stays in Chase until the user logs a transfer out
      // (see logged-transfer loop below).
      // NOTE: extraDeposit is external income deposited directly into the
      // vault (Marcus HYSA) - it never passes through Chase Checking, so it
      // is excluded from this flow.
      // Reimbursement is a tax-free pass-through that lands here and stays
      // here - no onward flow to BofA/vault/etc.
      for (const row of computed) {
        const payDateISO =
          typeof row.payDate === 'string'
            ? row.payDate
            : (row.payDate as Date).toISOString().slice(0, 10)
        const baseNet =
          row.received && row.actualNetWages != null
            ? row.actualNetWages
            : row.estimatedNet
        // Pre-cutover USC paychecks still drain RH per-paycheck (preserves
        // existing user-edited week-1/week-2 ledger entries). Post-cutover
        // RH flows out of Chase weekly, not per check — handled below.
        const rhDrain = payDateISO < RH_WEEKLY_CUTOVER ? row.robinhood : 0
        // Rent is NOT part of the immediate cascade — it lingers in Chase
        // until rentDate (default: 1st of month after payDate). Subtracted
        // separately below so toDate reflects the cash physically present.
        const autoFlow = baseNet + row.perDiem - row.vault - rhDrain
        fullSummer += autoFlow
        if (row.received) toDate += autoFlow
        // Reimbursement: invisible to allocations, but a real Chase inflow.
        fullSummer += row.reimbursement
        if (row.received) toDate += row.reimbursement
        // Rent: outflow lands on its own date.  fullSummer counts every
        // rent regardless; toDate only counts rents that have actually
        // happened by `today`.
        if (row.rentPaid > 0) {
          const rentDate = row.rentDateOverride ?? defaultRentDate(payDateISO)
          fullSummer -= row.rentPaid
          if (rentDate <= today) toDate -= row.rentPaid
        }
      }
      // Weekly Robinhood: $robinhoodWeekly drains Chase every Monday from
      // the cutover through internship end, regardless of paycheck cadence.
      if (settings.robinhoodWeekly > 0) {
        for (const monday of mondaysBetween(RH_WEEKLY_CUTOVER, INTERNSHIP_END)) {
          fullSummer -= settings.robinhoodWeekly
          if (monday <= today) toDate -= settings.robinhoodWeekly
        }
      }
      // Projected: assume the user WILL transfer the rest of the expected
      // overflow to BofA by end of summer.
      fullSummer -= remainingExpectedBofaTransfer
    } else if (account.is_vault) {
      // Vault account (Marcus HYSA): receives vault + extraDeposit each check.
      for (const row of computed) {
        const inflow = row.vault + row.extraDeposit
        fullSummer += inflow
        if (row.received) toDate += inflow
      }
    } else if (isBofaOverflow) {
      // BofA Checking: projected assumes the full expected overflow lands
      // here by end of summer. Current is driven ONLY by logged transfers
      // (added below) + expenses on this account.
      fullSummer += remainingExpectedBofaTransfer
    }
    // Other accounts (credit cards): no paycheck flows.

    // --- Logged transfer flows (apply to ALL accounts) ---
    for (const t of transfers) {
      if (t.from_account_id === account.id) {
        fullSummer -= t.amount
        if (t.transferred_at <= today) toDate -= t.amount
      }
      if (t.to_account_id === account.id) {
        fullSummer += t.amount
        if (t.transferred_at <= today) toDate += t.amount
      }
    }

    // --- Expense flows ---
    for (const exp of expenses) {
      if (exp.account_id !== account.id) continue
      const delta = account.type === 'credit_card' ? exp.amount : -exp.amount
      fullSummer += delta
      // No projected (future-dated) expenses are tracked separately yet, so
      // to-date matches full-summer for any expense already in the system.
      // We still gate by today's date for forward-compatibility.
      if (exp.expense_date <= today) toDate += delta
    }

    // --- CC payment flows ---
    // Default kind 'payment': money flows from checking -> CC.
    //   from (checking) loses cash, to (CC) outstanding shrinks → both -amt.
    // kind 'refund_claim': CC has a credit balance (negative outstanding)
    // and the bank ACHes it back to checking.
    //   from (checking) RISES, to (CC) outstanding RISES toward 0 → both +amt.
    for (const pay of ccPayments) {
      let delta = 0
      const sign = pay.kind === 'refund_claim' ? +1 : -1
      if (pay.from_account_id === account.id) {
        delta += sign * pay.amount
      }
      if (pay.to_account_id === account.id) {
        delta += sign * pay.amount
      }
      if (delta === 0) continue
      fullSummer += delta
      if (pay.paid_at <= today) toDate += delta
    }

    // --- Free-form account entry flows ---
    // Signed amounts: positive = balance up, negative = balance down. This
    // works uniformly for checking/HYSA (positive = inflow) and credit cards
    // (positive = outstanding goes up). No type-based negation.
    for (const entry of accountEntries) {
      if (entry.account_id !== account.id) continue
      fullSummer += entry.amount
      if (entry.dated_at <= today) toDate += entry.amount
    }

    return {
      account,
      arrival,
      current: arrival + toDate,
      projected: arrival + fullSummer,
    }
  })
}

/**
 * Aggregate totals across all computed rows for dashboard/summary views.
 *
 * `settings` is optional: pass it to get an exact `vaultRemaining`
 * (settings.vaultCap - totalVault). Without it, remaining is reported as 0
 * since rows alone don't carry the cap.
 *
 * "current*" totals sum across rows where received === true.
 * "total*" totals sum across all rows (received or projected).
 */
export function summarize(
  rows: PaycheckComputed[],
  settings?: Settings,
): {
  totalVault: number
  totalCO: number
  totalBuffer: number
  vaultRemaining: number
  rowsReceived: number
  rowsPending: number
  currentVault: number
  currentCO: number
  currentBuffer: number
} {
  const last = rows[rows.length - 1]
  const totalVault = last ? last.cumulativeVault : 0
  let totalCO = 0
  let totalBuffer = 0
  let rowsReceived = 0
  let rowsPending = 0
  let currentVault = 0
  let currentCO = 0
  let currentBuffer = 0
  for (const r of rows) {
    totalCO += r.co
    totalBuffer += r.buffer
    if (r.received) {
      rowsReceived++
      currentVault += r.vault + r.extraDeposit
      currentCO += r.co
      currentBuffer += r.buffer
    } else {
      rowsPending++
    }
  }
  // Clamp currentVault at the cap, mirroring cumulativeVault semantics.
  if (settings) {
    currentVault = Math.min(currentVault, settings.vaultCap)
  }
  const vaultRemaining = settings
    ? Math.max(0, settings.vaultCap - totalVault)
    : 0
  return {
    totalVault,
    totalCO,
    totalBuffer,
    vaultRemaining,
    rowsReceived,
    rowsPending,
    currentVault,
    currentCO,
    currentBuffer,
  }
}

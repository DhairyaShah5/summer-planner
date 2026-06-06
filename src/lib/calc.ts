/**
 * Pure TypeScript port of the Summer Planner allocation formulas.
 *
 * Allocation philosophy (post-2026-06 refactor):
 *   - All allocations (vault, CO Spend, BofA overflow) are multiples of $100.
 *   - Vault is SCHEDULED — it does not grow with overtime. The NTT vault target
 *     is `settings.nttVaultDefault` regardless of how big the actual check is;
 *     the USC vault target is `settings.uscNoRentVault` (or `uscRentVault` on
 *     a rent month).
 *   - Any pay above the no-OT projection (`expectedNoOT`) is "OT-driven excess"
 *     and routes to BofA Checking (an overflow buffer), NOT to vault or CO.
 *   - The cents/sub-$100 remainder lands in Buffer (still in Chase).
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
  vaultOverride: number | null
  rentPaid: number
  received: boolean
}

export interface PaycheckComputed extends PaycheckInput {
  gross: number
  netPct: number
  estimatedNet: number
  /** Projected net assuming no overtime — the "scheduled" check size. */
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

/**
 * Compute one paycheck row given the previous cumulative vault balance.
 * Threading prevCumulative through computeAll yields the full ledger.
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
    vaultOverride,
    rentPaid,
    received,
  } = input

  // 1. Gross (actual, with OT)
  let gross: number
  let expectedNoOTGross: number
  if (employer === 'USC On-Campus') {
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

  // 5. Expected no-OT net — the "scheduled" check size used to detect OT excess.
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

  // 10. Vault target — manual override, else employer-specific schedule
  let vaultTarget: number
  if (vaultOverride != null) {
    vaultTarget = Math.max(0, vaultOverride)
  } else if (employer === 'USC On-Campus') {
    vaultTarget = rentPaid > 0 ? settings.uscRentVault : settings.uscNoRentVault
  } else {
    vaultTarget = settings.nttVaultDefault
  }

  // 11. Vault available — actual money left after rent + RH, floored to $100.
  //     We use baseNet (full actual/projected) here, NOT usableNet — the scheduled
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

  // 13. Vault — pick the most restrictive limit, then floor100 for override safety
  const vault = floor100(Math.min(vaultTarget, vaultAvailable, vaultCapRoom))

  // 14. CO Spend — what's left of usableNet (+ per diem) after vault/rent/RH,
  //     floored to $100. Per diem is a CO-specific reimbursement so it lifts CO.
  const co = floor100(
    Math.max(0, usableNet + perDiem - vault - rentPaid - robinhood),
  )

  // 15. BofA overflow — OT-driven excess, floored to $100
  const bofaOverflow = floor100(excess)

  // 16. Buffer — sub-$100 remainder that didn't fit into any bucket, stays in Chase
  const buffer = Math.max(
    0,
    baseNet + perDiem - vault - rentPaid - robinhood - co - bofaOverflow,
  )

  // 17. Status — driven by the explicit `received` flag only.
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
 * flows — only expense activity.
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

export interface CCPaymentInput {
  id: string
  paid_at: string
  from_account_id: string
  to_account_id: string
  amount: number
}

export interface AccountState {
  account: AccountInput
  arrival: number
  /** arrival + activity through today (received paychecks, dated expenses) */
  current: number
  /** arrival + activity for the full summer (all paychecks, all known expenses) */
  projected: number
}

export function computeAccountStates(
  accounts: AccountInput[],
  paychecks: PaycheckInput[],
  expenses: ExpenseInput[],
  settings: Settings,
  ccPayments: CCPaymentInput[] = [],
): AccountState[] {
  const computed = computeAll(paychecks, settings)
  const todayISO = new Date().toISOString().slice(0, 10)

  return accounts.map((account) => {
    const arrival = account.arrival_balance
    let toDate = 0
    let fullSummer = 0

    // --- Paycheck-driven flows ---
    // Temporary heuristic: BofA Checking is matched by name. Replace with a
    // dedicated `is_overflow_destination` column once schema permits.
    const isBofaOverflow = account.name === 'BofA Checking'

    if (account.is_paycheck_destination) {
      // Paycheck destination (e.g. Chase Checking).
      // baseNet hits checking, then vault + rent + RH + bofaOverflow leave it.
      // NOTE: extraDeposit is external income deposited directly into the
      // vault (Marcus HYSA) — it never passes through Chase Checking, so it
      // is excluded from this flow.
      for (const row of computed) {
        const baseNet =
          row.received && row.actualNetWages != null
            ? row.actualNetWages
            : row.estimatedNet
        const netFlow =
          baseNet - row.vault - row.rentPaid - row.robinhood - row.bofaOverflow
        fullSummer += netFlow
        if (row.received) toDate += netFlow
      }
    } else if (account.is_vault) {
      // Vault account (Marcus HYSA): receives vault + extraDeposit each check.
      for (const row of computed) {
        const inflow = row.vault + row.extraDeposit
        fullSummer += inflow
        if (row.received) toDate += inflow
      }
    } else if (isBofaOverflow) {
      // BofA Checking: receives the OT-driven excess each check.
      for (const row of computed) {
        const inflow = row.bofaOverflow
        fullSummer += inflow
        if (row.received) toDate += inflow
      }
    }
    // Other accounts (credit cards): no paycheck flows.

    // --- Expense flows ---
    for (const exp of expenses) {
      if (exp.account_id !== account.id) continue
      const delta = account.type === 'credit_card' ? exp.amount : -exp.amount
      fullSummer += delta
      // No projected (future-dated) expenses are tracked separately yet, so
      // to-date matches full-summer for any expense already in the system.
      // We still gate by today's date for forward-compatibility.
      if (exp.expense_date <= todayISO) toDate += delta
    }

    // --- CC payment flows ---
    // A CC payment moves money from a checking-type "from" account to a
    // credit-card "to" account, reducing both balances. The from-account
    // loses cash; the to-account's outstanding balance shrinks.
    for (const pay of ccPayments) {
      let delta = 0
      if (pay.from_account_id === account.id) {
        delta -= pay.amount
      }
      if (pay.to_account_id === account.id) {
        delta -= pay.amount
      }
      if (delta === 0) continue
      fullSummer += delta
      if (pay.paid_at <= todayISO) toDate += delta
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

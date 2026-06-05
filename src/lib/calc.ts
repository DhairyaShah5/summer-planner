/**
 * Pure TypeScript port of the Summer Planner Excel allocation formulas.
 *
 * Mirrors the canonical xlsx logic (see project_paycheck_planner.md memory):
 *   - USC paychecks are baseline-gross with a $1,080 vault default, $600 on rent months
 *   - NTT paychecks compute gross from hours (OT @ 1.5x) and vault the net floored to $10
 *   - Vault is capped at settings.vaultCap; cumulativeVault tracks running total
 *   - Robinhood is a flat $200/check for USC, $0 for NTT
 *   - CO spend is floored to $10; the cents remainder lands in Buffer
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
  robinhood: number
  vault: number
  co: number
  buffer: number
  status: 'Received' | 'Pending'
  cumulativeVault: number
}

/** Floor `x` to the nearest multiple of 10 (e.g. 247.83 → 240). */
export function floor10(x: number): number {
  return Math.floor(x / 10) * 10
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

  // E: Gross
  let gross: number
  if (employer === 'USC On-Campus') {
    gross = settings.uscGrossBaseline
  } else {
    const hours = hoursWorked ?? 0
    gross = hours * settings.nttHourlyRate + otHours * settings.nttHourlyRate * 1.5
  }

  // F: Net %
  // Use observed net% only if the row is received AND we have an actual figure;
  // otherwise fall back to the projection rate. This prevents a stale typed
  // actualNetWages on a pending row from poisoning the projection.
  let netPct: number
  if (received && actualNetWages != null && gross > 0) {
    netPct = actualNetWages / gross
  } else {
    netPct = employer === 'USC On-Campus' ? settings.uscNetPct : settings.nttNetPct
  }

  // G: Estimated Net (always the projection)
  const estimatedNet = gross * netPct

  // Base net used downstream (L/M):
  //   received && actualNetWages != null → use actual
  //   otherwise                          → use the projection
  // An unchecked row therefore uses the projection even if a stale actual
  // value is sitting in the input field.
  const baseNet =
    received && actualNetWages != null ? actualNetWages : estimatedNet

  // K: Robinhood
  const robinhood =
    employer === 'USC On-Campus' ? settings.robinhoodWeekly * 2 : 0

  // I: Vault — capped at remaining cap room
  const capRoom = Math.max(0, settings.vaultCap - prevCumulative - extraDeposit)

  // When the row is received, the actual net is the hard ceiling on how much
  // we can allocate to vault after rent + RH. (When NOT received we project
  // against estimatedNet, but the baseline figures already assume that.)
  const actualAvailableForVault =
    received && actualNetWages != null
      ? Math.max(0, floor10(actualNetWages - rentPaid - robinhood))
      : null

  let vault: number
  if (vaultOverride != null) {
    // Manual override: still respect cap room, and if received, also cap at
    // what the actual net check can cover after rent + RH. Same bug class.
    let v = Math.min(vaultOverride, capRoom)
    if (actualAvailableForVault != null) {
      v = Math.min(v, actualAvailableForVault)
    }
    vault = Math.max(0, v)
  } else if (employer === 'USC On-Campus') {
    const uscDefault = rentPaid > 0 ? settings.uscRentVault : settings.uscNoRentVault
    let v = Math.min(uscDefault, capRoom)
    if (actualAvailableForVault != null && actualAvailableForVault < v) {
      // Real check came in light — don't overdraw it.
      v = actualAvailableForVault
    }
    vault = Math.max(0, v)
  } else {
    // NTT: vault floor10(net) regardless. floor10 already lives in baseNet's
    // computation pathway above (we floor explicitly here for clarity).
    vault = Math.min(floor10(baseNet), capRoom)
  }

  // L: CO spend (floored to $10)
  const co = Math.max(
    0,
    floor10(baseNet + perDiem - vault - rentPaid - robinhood),
  )

  // M: Buffer (cents remainder)
  const buffer = Math.max(
    0,
    baseNet + perDiem - vault - rentPaid - robinhood - co,
  )

  // O: Status — driven by the explicit `received` flag only.
  const status: 'Received' | 'Pending' = received ? 'Received' : 'Pending'

  // R: Cumulative Vault
  const cumulativeVault = Math.min(
    settings.vaultCap,
    prevCumulative + extraDeposit + vault,
  )

  return {
    ...input,
    gross,
    netPct,
    estimatedNet,
    robinhood,
    vault,
    co,
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

// Pure parsing helpers shared between the client preview and the server action.
// No 'use server' / 'use client' here so it can be imported from either side.
import * as XLSX from 'xlsx'

export type ParsedSettings = {
  vault_cap: number
  rent_monthly: number
  rent_months: number
  robinhood_weekly: number
  usc_gross_baseline: number
  usc_net_pct: number
  ntt_hourly_rate: number
  ntt_net_pct: number
  usc_no_rent_vault: number
  usc_rent_vault: number
}

export type ParsedPaycheck = {
  pay_num: number
  pay_date: string
  employer: string
  hours_worked: number | null
  actual_net_wages: number | null
  vault_override: number | null
  rent_paid: number
  per_diem: number
  extra_deposit: number
  ot_hours: number
  notes: string | null
}

export type ParsedWorkbook = {
  settings: ParsedSettings
  paychecks: ParsedPaycheck[]
}

type XLSXCell = {
  v?: string | number | boolean | Date
  t?: string
  f?: string
}

type XLSXSheet = Record<string, XLSXCell | unknown>

function num(cell: XLSXCell | undefined, fallback = 0): number {
  if (!cell) return fallback
  const v = cell.v
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function numOrNull(cell: XLSXCell | undefined): number | null {
  if (!cell) return null
  const v = cell.v
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function str(cell: XLSXCell | undefined): string | null {
  if (!cell) return null
  const v = cell.v
  if (typeof v === 'string') return v.trim() || null
  if (v == null) return null
  return String(v)
}

function dateStr(cell: XLSXCell | undefined): string | null {
  if (!cell) return null
  const v = cell.v
  if (v instanceof Date) {
    const y = v.getUTCFullYear()
    const m = String(v.getUTCMonth() + 1).padStart(2, '0')
    const d = String(v.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof v === 'string') return v.slice(0, 10)
  return null
}

function cellOf(sheet: XLSXSheet, addr: string): XLSXCell | undefined {
  return sheet[addr] as XLSXCell | undefined
}

export function parseWorkbook(arrayBuffer: ArrayBuffer): ParsedWorkbook {
  // We intentionally let formulas come through (cellFormula default true)
  // so we can distinguish hardcoded numbers from formula results in column I.
  const wb = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    cellNF: false,
    cellDates: true,
  })

  const inputs = wb.Sheets['Inputs'] as XLSXSheet | undefined
  if (!inputs) {
    throw new Error('Missing "Inputs" sheet in workbook')
  }

  const settings: ParsedSettings = {
    vault_cap: num(cellOf(inputs, 'B6')),
    rent_monthly: num(cellOf(inputs, 'B11')),
    rent_months: Math.round(num(cellOf(inputs, 'B12'))),
    robinhood_weekly: num(cellOf(inputs, 'B13')),
    usc_gross_baseline: num(cellOf(inputs, 'B16')),
    usc_net_pct: num(cellOf(inputs, 'B17')),
    ntt_hourly_rate: num(cellOf(inputs, 'B18')),
    ntt_net_pct: num(cellOf(inputs, 'B20')),
    usc_no_rent_vault: num(cellOf(inputs, 'B35')),
    usc_rent_vault: num(cellOf(inputs, 'B45')),
  }

  const plan = wb.Sheets['Paycheck Plan'] as XLSXSheet | undefined
  if (!plan) {
    throw new Error('Missing "Paycheck Plan" sheet in workbook')
  }

  const paychecks: ParsedPaycheck[] = []
  for (let r = 5; r <= 18; r++) {
    const aCell = cellOf(plan, `A${r}`)
    const bCell = cellOf(plan, `B${r}`)
    const cCell = cellOf(plan, `C${r}`)
    if (!aCell || !bCell || !cCell) continue

    const payNum = Math.round(num(aCell))
    const payDate = dateStr(bCell)
    const employer = str(cCell)
    if (!payDate || !employer) continue

    const iCell = cellOf(plan, `I${r}`)
    // vault_override: only keep if the cell is a literal number, not a formula.
    const vaultOverride =
      iCell && !iCell.f && typeof iCell.v === 'number' ? iCell.v : null

    paychecks.push({
      pay_num: payNum,
      pay_date: payDate,
      employer,
      hours_worked: numOrNull(cellOf(plan, `D${r}`)),
      actual_net_wages: numOrNull(cellOf(plan, `H${r}`)),
      vault_override: vaultOverride,
      rent_paid: num(cellOf(plan, `J${r}`)),
      per_diem: num(cellOf(plan, `T${r}`)),
      extra_deposit: num(cellOf(plan, `Q${r}`)),
      ot_hours: num(cellOf(plan, `S${r}`)),
      notes: str(cellOf(plan, `N${r}`)),
    })
  }

  return { settings, paychecks }
}

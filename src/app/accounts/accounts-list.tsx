'use client'

import * as React from 'react'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRightIcon,
  ArrowUpRight,
  CreditCardIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  Trash2Icon,
  TrendingUpIcon,
  TrendingDownIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Money,
  Pill,
  Reveal,
  SectionLabel,
  Donut,
  CatDot,
  ProgressBar,
  fmtDate,
  fmtMoney,
} from '@/components/redesign'
import { payCreditCard } from './cc-payment-actions'
import { logTransfer } from './transfer-actions'
import { updateNetWorthInclusion } from './net-worth-actions'
import {
  addAccountEntry,
  deleteAccountEntry,
  updateAccountEntry,
} from './account-entry-actions'
import { setFlowOverride, type FlowKind } from './flow-override-actions'
import { Checkbox } from '@/components/ui/checkbox'
import { useViewMode } from '@/components/view-mode-context'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { EXPENSE_CATEGORIES, hueForCategory } from '@/app/expenses/categories'
import {
  INTERNSHIP_END,
  RH_WEEKLY_CUTOVER,
  mondaysBetween,
} from '@/lib/calc'

export type AccountType = 'checking' | 'credit_card' | 'hysa'

export type TransferKind =
  | 'manual'
  | 'rollover_sweep'
  | 'per_diem_to_bofa'
  | 'ot_to_bofa'
  | 'vault_topup_sweep'

export interface AccountStateRow {
  id: string
  name: string
  type: AccountType
  arrival: number
  current: number
  projected: number
  is_paycheck_destination: boolean
  is_vault: boolean
  display_order: number
  include_in_net_worth: boolean
}

export interface TransferRow {
  id: string
  transferred_at: string
  from_account_id: string
  to_account_id: string
  amount: number
  kind: TransferKind
  note: string | null
}

/** Raw account_entries row passed down for the ledger modal. */
export interface LedgerEntryRow {
  id: string
  account_id: string
  dated_at: string
  amount: number
  description: string
  category: string | null
  note: string | null
  created_at: string
}

/** Expense row enriched with description/category for ledger rendering. */
export interface LedgerExpenseRow {
  id: string
  expense_date: string
  amount: number
  account_id: string | null
  description: string
  category: string
}

/** Slimmed CC payment row used to derive ledger entries on both sides. */
export interface LedgerCCPaymentRow {
  id: string
  paid_at: string
  from_account_id: string
  to_account_id: string
  amount: number
  kind?: 'payment' | 'refund_claim'
}

/** Per-paycheck summary needed to derive ledger entries client-side without
 *  recomputing the allocation formulas. */
export interface PaycheckRow {
  id: string
  payNum: number
  payDate: string
  employer: string
  baseNet: number
  perDiem: number
  reimbursement: number
  vault: number
  extraDeposit: number
  rentPaid: number
  robinhood: number
  bofaOverflow: number
  received: boolean
  flow_overrides: Record<string, string>
}

/** Source kind for a derived ledger entry. Drives pill color + delete control.
 *  The three split-out flow sources let users color-code and override the
 *  effective date of vault/rent/robinhood outflows independently. */
export type LedgerSource =
  | 'arrival'
  | 'paycheck'
  | 'vault_transfer'
  | 'rent_payment'
  | 'robinhood_transfer'
  | 'expense'
  | 'cc_payment'
  | 'transfer'
  | 'manual'

interface DerivedLedgerEntry {
  key: string
  date: string
  source: LedgerSource
  description: string
  amount: number
  manualId?: string
  runningBalance: number
  // For overridable paycheck-derived flows: the paycheck id and the kind so
  // the inline date editor can call setFlowOverride for the correct row.
  paycheckId?: string
  overrideKind?: 'vault' | 'rent' | 'robinhood' | 'robinhood_2'
  hasOverride?: boolean
  // Carries the expense category through to the row so the renderer can
  // render the small tinted category tag underneath the description.
  category?: string
}

const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function todayISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

/** Shift an ISO yyyy-MM-dd date by N days (positive or negative). Parses as
 *  local midnight to avoid timezone drift on the date boundary. */
function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + days)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Hue lookup keyed by readable substrings of account names. Falls back to
// neutral blue if no match (kept in sync with the design handoff palette).
function hueForAccount(name: string, type: AccountType, isVault: boolean): number {
  const n = name.toLowerCase()
  if (type === 'credit_card') return 25
  if (isVault || type === 'hysa' || n.includes('marcus') || n.includes('hysa')) return 285
  if (n.includes('bofa') || n.includes('bank of america')) return 200
  if (n.includes('chase')) return 235
  return 235
}

function hueForTag(tag: string): number {
  if (tag === 'Vault' || tag === 'HYSA') return 285
  if (tag === 'Credit Card') return 25
  if (tag === 'Paycheck') return 150
  return 235
}

function typeLabel(t: AccountType): string {
  switch (t) {
    case 'checking':
      return 'Checking'
    case 'credit_card':
      return 'Credit Card'
    case 'hysa':
      return 'HYSA'
  }
}

function transferKindLabel(k: TransferKind): string {
  switch (k) {
    case 'manual':
      return 'Manual'
    case 'rollover_sweep':
      return 'Rollover sweep'
    case 'per_diem_to_bofa':
      return 'Per diem'
    case 'ot_to_bofa':
      return 'Overtime'
    case 'vault_topup_sweep':
      return 'Vault top-up'
  }
}

function transferKindTone(
  k: TransferKind,
): 'received' | 'upcoming' | 'accent' {
  return k === 'manual' ? 'upcoming' : 'accent'
}

interface Props {
  states: AccountStateRow[]
  vaultCap: number
  transfers: TransferRow[]
  entries: LedgerEntryRow[]
  expenses: LedgerExpenseRow[]
  ccPayments: LedgerCCPaymentRow[]
  paycheckRows: PaycheckRow[]
  robinhoodWeekly: number
}

export function AccountsList({
  states,
  vaultCap,
  transfers,
  entries,
  expenses,
  ccPayments,
  paycheckRows,
  robinhoodWeekly,
}: Props) {
  const router = useRouter()
  const viewMode = useViewMode()
  const [editing, setEditing] = useState<AccountStateRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Pay-CC dialog state
  const [paying, setPaying] = useState<AccountStateRow | null>(null)
  const [payFromId, setPayFromId] = useState<string>('')
  const [payAmount, setPayAmount] = useState<string>('')
  const [payDate, setPayDate] = useState<string>(todayISO())
  // 'payment'      = drain checking, drop CC outstanding (normal)
  // 'refund_claim' = bank ACHes credit balance to checking (CC.current < 0)
  const [payKind, setPayKind] = useState<'payment' | 'refund_claim'>('payment')
  const [payPending, startPayTransition] = useTransition()

  // Log-transfer dialog state
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferFromId, setTransferFromId] = useState<string>('')
  const [transferToId, setTransferToId] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')
  const [transferDate, setTransferDate] = useState<string>(todayISO())
  const [transferNote, setTransferNote] = useState<string>('')
  const [transferPending, startTransferTransition] = useTransition()

  // Net-worth customization dialog state. Draft holds the in-flight toggles
  // so the user can flip several before committing on Save.
  const [netWorthOpen, setNetWorthOpen] = useState(false)
  const [netWorthDraft, setNetWorthDraft] = useState<Record<string, boolean>>(
    {},
  )
  const [netWorthSaving, startNetWorthTransition] = useTransition()

  // Per-account ledger modal state. `ledgerAccount` doubles as both the
  // "is open?" flag (truthy = open) and the data source for derivation.
  const [ledgerAccount, setLedgerAccount] = useState<AccountStateRow | null>(
    null,
  )
  const [ledgerFormOpen, setLedgerFormOpen] = useState(false)
  const [ledgerDate, setLedgerDate] = useState<string>(todayISO())
  const [ledgerDirection, setLedgerDirection] = useState<'in' | 'out'>('in')
  const [ledgerAmount, setLedgerAmount] = useState<string>('')
  const [ledgerDescription, setLedgerDescription] = useState<string>('')
  const [ledgerCategory, setLedgerCategory] = useState<string>('')
  const [ledgerNote, setLedgerNote] = useState<string>('')
  const [ledgerSaving, startLedgerTransition] = useTransition()
  const [ledgerDeletingId, setLedgerDeletingId] = useState<string | null>(null)
  // When non-null, the form is editing an existing manual entry. When null,
  // the form is creating a fresh one.
  const [ledgerEditingId, setLedgerEditingId] = useState<string | null>(null)
  // Inline flow-override popover state keyed by row.key so multiple popovers
  // (vault/rent/robinhood) on different rows don't fight over a shared input.
  const [overridePopoverKey, setOverridePopoverKey] = useState<string | null>(
    null,
  )
  const [overrideDateDraft, setOverrideDateDraft] = useState<string>('')
  const [overrideSavingKey, setOverrideSavingKey] = useState<string | null>(
    null,
  )

  function handleSaveFlowOverride(
    rowKey: string,
    paycheckId: string,
    kind: FlowKind,
    newDate: string,
  ) {
    if (!newDate) {
      toast.error('Pick a date')
      return
    }
    setOverrideSavingKey(rowKey)
    setFlowOverride({ paycheck_id: paycheckId, kind, dated_at: newDate })
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error ?? 'Could not save override')
          return
        }
        toast.success('Date updated')
        setOverridePopoverKey(null)
        router.refresh()
      })
      .finally(() => setOverrideSavingKey(null))
  }

  function handleResetFlowOverride(
    rowKey: string,
    paycheckId: string,
    kind: FlowKind,
  ) {
    setOverrideSavingKey(rowKey)
    setFlowOverride({ paycheck_id: paycheckId, kind, dated_at: null })
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error ?? 'Could not reset override')
          return
        }
        toast.success('Reset to paycheck date')
        setOverridePopoverKey(null)
        router.refresh()
      })
      .finally(() => setOverrideSavingKey(null))
  }

  function openNetWorthDialog() {
    const draft: Record<string, boolean> = {}
    for (const s of states) draft[s.id] = s.include_in_net_worth
    setNetWorthDraft(draft)
    setNetWorthOpen(true)
  }

  function toggleNetWorthDraft(id: string) {
    setNetWorthDraft((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
  }

  function openLedger(account: AccountStateRow) {
    setLedgerAccount(account)
    setLedgerFormOpen(false)
    resetLedgerForm()
  }

  function closeLedger() {
    setLedgerAccount(null)
    setLedgerFormOpen(false)
  }

  function resetLedgerForm() {
    setLedgerDate(todayISO())
    setLedgerDirection('in')
    setLedgerAmount('')
    setLedgerDescription('')
    setLedgerCategory('')
    setLedgerNote('')
    setLedgerEditingId(null)
  }

  function startLedgerEdit(manualId: string) {
    const raw = entries.find((e) => e.id === manualId)
    if (!raw) return
    setLedgerEditingId(manualId)
    setLedgerDate(raw.dated_at)
    setLedgerDirection(raw.amount >= 0 ? 'in' : 'out')
    setLedgerAmount(Math.abs(raw.amount).toFixed(2))
    setLedgerDescription(raw.description)
    setLedgerCategory(raw.category ?? '')
    setLedgerNote(raw.note ?? '')
    setLedgerFormOpen(true)
  }

  function handleLedgerSubmit() {
    if (!ledgerAccount) return
    const raw = parseFloat(ledgerAmount)
    if (!Number.isFinite(raw) || raw <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const trimmedDesc = ledgerDescription.trim()
    if (!trimmedDesc) {
      toast.error('Description required')
      return
    }
    const signed = ledgerDirection === 'in' ? raw : -raw
    const acctId = ledgerAccount.id
    const editingId = ledgerEditingId
    startLedgerTransition(async () => {
      const res = editingId
        ? await updateAccountEntry({
            id: editingId,
            dated_at: ledgerDate,
            amount: signed,
            description: trimmedDesc,
            category: ledgerCategory,
            note: ledgerNote,
          })
        : await addAccountEntry({
            account_id: acctId,
            dated_at: ledgerDate,
            amount: signed,
            description: trimmedDesc,
            category: ledgerCategory,
            note: ledgerNote,
          })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save entry')
        return
      }
      toast.success(editingId ? 'Entry updated' : 'Ledger entry added')
      setLedgerFormOpen(false)
      resetLedgerForm()
      router.refresh()
    })
  }

  function handleLedgerDelete(id: string) {
    if (!window.confirm('Delete this ledger entry?')) return
    setLedgerDeletingId(id)
    deleteAccountEntry(id)
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error ?? 'Could not delete entry')
          return
        }
        toast.success('Entry deleted')
        router.refresh()
      })
      .finally(() => setLedgerDeletingId(null))
  }

  function saveNetWorthSelections() {
    const selections = states
      .filter((s) => (netWorthDraft[s.id] ?? true) !== s.include_in_net_worth)
      .map((s) => ({ id: s.id, include: netWorthDraft[s.id] ?? true }))
    if (selections.length === 0) {
      setNetWorthOpen(false)
      return
    }
    startNetWorthTransition(async () => {
      const res = await updateNetWorthInclusion(selections)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save')
        return
      }
      toast.success('Net worth selection updated')
      setNetWorthOpen(false)
      router.refresh()
    })
  }

  const checkingAccounts = useMemo(
    () => states.filter((s) => s.type === 'checking'),
    [states],
  )
  const defaultFromAccount = useMemo(
    () =>
      checkingAccounts.find((s) => s.is_paycheck_destination) ??
      checkingAccounts[0] ??
      null,
    [checkingAccounts],
  )
  const transferableAccounts = useMemo(
    () => states.filter((s) => s.type !== 'credit_card'),
    [states],
  )
  const defaultTransferFromId = useMemo(() => {
    const chase = transferableAccounts.find((a) =>
      a.name.toLowerCase().includes('chase'),
    )
    return chase?.id ?? transferableAccounts[0]?.id ?? ''
  }, [transferableAccounts])
  const defaultTransferToId = useMemo(() => {
    const bofa = transferableAccounts.find(
      (a) =>
        a.name.toLowerCase().includes('bofa') ||
        a.name.toLowerCase().includes('bank of america'),
    )
    if (bofa) return bofa.id
    const fallback = transferableAccounts.find(
      (a) => a.id !== defaultTransferFromId,
    )
    return fallback?.id ?? ''
  }, [transferableAccounts, defaultTransferFromId])

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of states) map.set(s.id, s.name)
    return map
  }, [states])

  const recentTransfers = useMemo(() => transfers.slice(0, 10), [transfers])

  // Stable source-ordering for the secondary sort below: arrival always wins
  // on its date so the ledger reads top-down as "you started with X, then..."
  // The three split-out flow sources slot in between the paycheck inflow and
  // the generic transfer/CC payment/expense rows so a single date reads
  // intuitively top-down: arrival -> paycheck -> vault -> rent -> robinhood
  // -> any other transfers/payments/expenses on that date.
  const sourceOrder: Record<LedgerSource, number> = {
    arrival: 0,
    paycheck: 1,
    vault_transfer: 2,
    rent_payment: 3,
    robinhood_transfer: 4,
    transfer: 5,
    cc_payment: 6,
    expense: 7,
    manual: 8,
  }

  // Derive the full chronological ledger for the currently-open account.
  // Pulls inflows/outflows from every source: arrival, paychecks (split by
  // sub-flow), expenses, cc_payments, transfers, manual account_entries.
  // Running balance is computed by walking the sorted list once.
  const ledgerEntries = useMemo<DerivedLedgerEntry[]>(() => {
    if (!ledgerAccount) return []
    const acctId = ledgerAccount.id
    const acctType = ledgerAccount.type
    const isPaycheckDest = ledgerAccount.is_paycheck_destination
    const isVault = ledgerAccount.is_vault

    const items: Omit<DerivedLedgerEntry, 'runningBalance'>[] = []

    // 1. Arrival entry - sentinel start-of-summer balance.
    items.push({
      key: `arrival-${acctId}`,
      date: '2026-05-26',
      source: 'arrival',
      description: 'Arrival balance',
      amount: ledgerAccount.arrival,
    })

    // 2. Paycheck-driven flows. Only relevant for Chase (paycheck dest) and
    //    the Marcus HYSA vault account. Pulled from pre-computed paycheckRows
    //    so we never re-run allocation math here.
    if (isPaycheckDest) {
      for (const p of paycheckRows) {
        if (!p.received) continue
        const label = `${p.employer.replace(' On-Campus', '').replace('Colorado Internship', 'NTT')} paycheck`
        const inflow = p.baseNet + p.perDiem + p.reimbursement
        if (inflow > 0) {
          items.push({
            key: `pay-in-${p.payNum}`,
            date: p.payDate,
            source: 'paycheck',
            description: label,
            amount: inflow,
          })
        }
        if (p.vault > 0) {
          const vaultOverride = p.flow_overrides.vault
          items.push({
            key: `pay-vault-${p.payNum}`,
            date: vaultOverride ?? p.payDate,
            source: 'vault_transfer',
            description: 'Vault transfer to HYSA',
            amount: -p.vault,
            paycheckId: p.id,
            overrideKind: 'vault',
            hasOverride: Boolean(vaultOverride),
          })
        }
        if (p.rentPaid > 0) {
          const rentOverride = p.flow_overrides.rent
          items.push({
            key: `pay-rent-${p.payNum}`,
            date: rentOverride ?? p.payDate,
            source: 'rent_payment',
            description: 'Rent paid',
            amount: -p.rentPaid,
            paycheckId: p.id,
            overrideKind: 'rent',
            hasOverride: Boolean(rentOverride),
          })
        }
        if (p.robinhood > 0) {
          // Per-paycheck RH split is retained ONLY for entries dated before
          // the RH_WEEKLY_CUTOVER — those are the legacy rows the user already
          // edited (e.g. May 28 + Jun 1). Post-cutover RH lives as a weekly
          // Monday entry generated below, independent of paycheck cadence.
          const half = p.robinhood / 2
          const rh1Override = p.flow_overrides.robinhood
          const rh2Override = p.flow_overrides.robinhood_2
          const date1 = rh1Override ?? p.payDate
          const date2 = rh2Override ?? shiftIsoDate(p.payDate, 7)
          if (date1 < RH_WEEKLY_CUTOVER) {
            items.push({
              key: `pay-rh1-${p.payNum}`,
              date: date1,
              source: 'robinhood_transfer',
              description: 'Robinhood (week 1)',
              amount: -half,
              paycheckId: p.id,
              overrideKind: 'robinhood',
              hasOverride: Boolean(rh1Override),
            })
          }
          if (date2 < RH_WEEKLY_CUTOVER) {
            items.push({
              key: `pay-rh2-${p.payNum}`,
              date: date2,
              source: 'robinhood_transfer',
              description: 'Robinhood (week 2)',
              amount: -half,
              paycheckId: p.id,
              overrideKind: 'robinhood_2',
              hasOverride: Boolean(rh2Override),
            })
          }
        }
      }
      // Weekly Robinhood: one $robinhoodWeekly entry per Monday from the
      // cutover through TODAY, no paycheck attachment. Future Mondays don't
      // render until they actually arrive — mirrors how future paycheck
      // entries stay hidden until the paycheck is marked received. (The
      // projected balance in computeAccountStates still accounts for every
      // remaining Monday.)
      if (robinhoodWeekly > 0) {
        const today = todayISO()
        for (const monday of mondaysBetween(RH_WEEKLY_CUTOVER, INTERNSHIP_END)) {
          if (monday > today) break
          items.push({
            key: `rh-weekly-${monday}`,
            date: monday,
            source: 'robinhood_transfer',
            description: 'Robinhood',
            amount: -robinhoodWeekly,
          })
        }
      }
    } else if (isVault) {
      for (const p of paycheckRows) {
        if (!p.received) continue
        const inflow = p.vault + p.extraDeposit
        if (inflow > 0) {
          // Vault inflows on the HYSA mirror the Chase-side outflow date so
          // the override applied on the Chase side propagates here too.
          const vaultOverride = p.flow_overrides.vault
          items.push({
            key: `pay-vault-in-${p.payNum}`,
            date: vaultOverride ?? p.payDate,
            source: 'vault_transfer',
            description: `${p.employer.replace(' On-Campus', '').replace('Colorado Internship', 'NTT')} vault deposit`,
            amount: inflow,
            paycheckId: p.id,
            overrideKind: 'vault',
            hasOverride: Boolean(vaultOverride),
          })
        }
      }
    }
    // BofA Checking + credit cards: nothing auto-derived from paychecks.

    // 3. Expenses landing on this account.
    for (const e of expenses) {
      if (e.account_id !== acctId) continue
      // Credit-card expenses grow outstanding balance; everywhere else they
      // drain cash. Matches the sign convention used in computeAccountStates.
      const amount = acctType === 'credit_card' ? +e.amount : -e.amount
      items.push({
        key: `exp-${e.id}`,
        date: e.expense_date,
        source: 'expense',
        description: e.description || 'Expense',
        amount,
        category: e.category,
      })
    }

    // 4. CC payments touching this account. Default 'payment' flows checking
    //    -> CC (both deltas negative). 'refund_claim' flows the other way
    //    (both deltas positive: checking rises, CC outstanding rises toward 0).
    for (const pay of ccPayments) {
      const isRefund = pay.kind === 'refund_claim'
      const sign = isRefund ? +1 : -1
      if (pay.from_account_id === acctId) {
        const toName = accountNameById.get(pay.to_account_id) ?? 'credit card'
        items.push({
          key: `cc-from-${pay.id}`,
          date: pay.paid_at,
          source: 'cc_payment',
          description: isRefund
            ? `Refund claim from ${toName}`
            : `Payment to ${toName}`,
          amount: sign * pay.amount,
        })
      }
      if (pay.to_account_id === acctId) {
        const fromName =
          accountNameById.get(pay.from_account_id) ?? 'checking'
        items.push({
          key: `cc-to-${pay.id}`,
          date: pay.paid_at,
          source: 'cc_payment',
          description: isRefund
            ? `Refund applied to ${fromName}`
            : `Payment from ${fromName}`,
          amount: sign * pay.amount,
        })
      }
    }

    // 5. Transfers in/out.
    for (const t of transfers) {
      if (t.from_account_id === acctId) {
        const toName = accountNameById.get(t.to_account_id) ?? 'account'
        const suffix = t.kind !== 'manual' ? ` (${transferKindLabel(t.kind)})` : ''
        items.push({
          key: `xfer-from-${t.id}`,
          date: t.transferred_at,
          source: 'transfer',
          description: `Transfer to ${toName}${suffix}`,
          amount: -t.amount,
        })
      }
      if (t.to_account_id === acctId) {
        const fromName = accountNameById.get(t.from_account_id) ?? 'account'
        items.push({
          key: `xfer-to-${t.id}`,
          date: t.transferred_at,
          source: 'transfer',
          description: `Transfer from ${fromName}`,
          amount: +t.amount,
        })
      }
    }

    // 6. Manual free-form ledger entries.
    for (const entry of entries) {
      if (entry.account_id !== acctId) continue
      items.push({
        key: `manual-${entry.id}`,
        date: entry.dated_at,
        source: 'manual',
        description: entry.description,
        amount: entry.amount,
        manualId: entry.id,
      })
    }

    // Sort by date ASC, breaking ties via the source order map so arrival
    // wins, then paycheck inflows precede expenses on the same day, etc.
    // We walk in ASC to compute running balance, then reverse for display
    // so the newest entry shows first (matches the Expenses page convention).
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return sourceOrder[a.source] - sourceOrder[b.source]
    })

    let running = 0
    const ascending: DerivedLedgerEntry[] = []
    for (const it of items) {
      running += it.amount
      ascending.push({ ...it, runningBalance: running })
    }
    return ascending.reverse()
    // sourceOrder is module-stable so we intentionally omit it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ledgerAccount,
    paycheckRows,
    expenses,
    ccPayments,
    transfers,
    entries,
    accountNameById,
    robinhoodWeekly,
  ])

  function openTransferDialog() {
    setTransferFromId(defaultTransferFromId)
    setTransferToId(defaultTransferToId)
    setTransferAmount('')
    setTransferDate(todayISO())
    setTransferNote('')
    setTransferOpen(true)
  }

  function closeTransferDialog() {
    setTransferOpen(false)
  }

  function handleTransferSubmit() {
    const amount = parseFloat(transferAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!transferFromId || !transferToId) {
      toast.error('Pick both accounts')
      return
    }
    if (transferFromId === transferToId) {
      toast.error('From and to must differ')
      return
    }
    startTransferTransition(async () => {
      const res = await logTransfer({
        fromAccountId: transferFromId,
        toAccountId: transferToId,
        amount,
        transferredAt: transferDate,
        note: transferNote,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not log transfer')
        return
      }
      toast.success('Transfer logged')
      setTransferOpen(false)
      router.refresh()
    })
  }

  function openPayDialog(cc: AccountStateRow) {
    setPaying(cc)
    // Default to the checking account that shares the CC's bank (BofA CC
    // → BofA Checking, Chase CC → Chase Checking). Fall back to the
    // paycheck-destination checking if no name match is found.
    const ccBank = cc.name.toLowerCase()
    const matchingChecking = checkingAccounts.find((a) => {
      const n = a.name.toLowerCase()
      if (ccBank.includes('bofa') || ccBank.includes('bank of america')) {
        return n.includes('bofa') || n.includes('bank of america')
      }
      if (ccBank.includes('chase')) return n.includes('chase')
      return false
    })
    setPayFromId(matchingChecking?.id ?? defaultFromAccount?.id ?? '')
    // Default kind based on the CC's current state: if the card has a
    // credit balance (outstanding < 0), assume the user wants to claim
    // it back. Prefill amount to the absolute outstanding either way.
    if (cc.current < 0) {
      setPayKind('refund_claim')
      setPayAmount(Math.abs(cc.current).toFixed(2))
    } else {
      setPayKind('payment')
      setPayAmount(cc.current > 0 ? cc.current.toFixed(2) : '0.00')
    }
    setPayDate(todayISO())
  }

  function closePayDialog() {
    setPaying(null)
  }

  function handlePaySubmit() {
    if (!paying) return
    const amount = parseFloat(payAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!payFromId) {
      toast.error('Select a from account')
      return
    }
    const ccName = paying.name
    const toAccountId = paying.id
    startPayTransition(async () => {
      const res = await payCreditCard({
        fromAccountId: payFromId,
        toAccountId,
        amount,
        paidAt: payDate,
        kind: payKind,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not record payment')
        return
      }
      toast.success(`Paid ${moneyFmt.format(amount)} to ${ccName}`)
      setPaying(null)
      router.refresh()
    })
  }

  const summary = useMemo(() => {
    let arrivalCash = 0
    let arrivalDebt = 0
    let projectedCash = 0
    let projectedDebt = 0
    let currentCash = 0
    let currentDebt = 0
    let excludedCount = 0
    for (const s of states) {
      if (!s.include_in_net_worth) {
        excludedCount++
        continue
      }
      if (s.type === 'credit_card') {
        arrivalDebt += s.arrival
        projectedDebt += s.projected
        currentDebt += s.current
      } else {
        arrivalCash += s.arrival
        projectedCash += s.projected
        currentCash += s.current
      }
    }
    const arrivalNet = arrivalCash - arrivalDebt
    const projectedNet = projectedCash - projectedDebt
    const currentNet = currentCash - currentDebt
    return {
      arrivalNet,
      projectedNet,
      currentNet,
      delta: projectedNet - arrivalNet,
      excludedCount,
    }
  }, [states])

  const composition = useMemo(() => {
    const assets = states.filter((s) => s.type !== 'credit_card')
    const items = assets.map((a) => ({
      label: a.name,
      hue: hueForAccount(a.name, a.type, a.is_vault),
      total: Math.max(0, a.current),
    }))
    const total = items.reduce((s, c) => s + c.total, 0)
    return { items, total }
  }, [states])

  async function handleSave() {
    if (!editing) return
    const parsed = parseFloat(editValue)
    if (!Number.isFinite(parsed)) {
      toast.error('Enter a valid number')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('accounts')
        .update({ arrival_balance: parsed })
        .eq('id', editing.id)
      if (error) throw error
      toast.success('Arrival balance updated')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const gained = summary.delta >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        {!viewMode && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openTransferDialog}
            disabled={transferableAccounts.length < 2}
          >
            <RepeatIcon className="size-4" />
            Log a transfer
          </Button>
        )}
      </div>

      {/* 3 net cards: arrival / now / projected. Each opens the
          net-worth customization dialog when clicked. */}
      <div
        className="accounts-netcards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        <Reveal>
          <NetWorthCardButton onClick={viewMode ? undefined : openNetWorthDialog}>
            <NetCard
              label="At arrival"
              sub="Came to Colorado with"
              value={summary.arrivalNet}
            />
          </NetWorthCardButton>
        </Reveal>
        <Reveal delay={50}>
          <NetWorthCardButton onClick={viewMode ? undefined : openNetWorthDialog}>
            <NetCard
              label="Right now"
              sub="Live net worth today"
              value={summary.currentNet}
              big
            />
          </NetWorthCardButton>
        </Reveal>
        <Reveal delay={100}>
          <NetWorthCardButton onClick={viewMode ? undefined : openNetWorthDialog}>
            <NetCard
              label="Leaving with (projected)"
              sub="Net worth at summer's end"
              value={summary.projectedNet}
              accent
            />
          </NetWorthCardButton>
        </Reveal>
      </div>
      {summary.excludedCount > 0 && (
        <p
          style={{
            margin: '-10px 0 0',
            textAlign: 'center',
            font: '500 12px var(--ui)',
            color: 'var(--ink-3)',
          }}
        >
          {summary.excludedCount} account
          {summary.excludedCount === 1 ? '' : 's'} excluded from net worth.
          Click any card to adjust.
        </p>
      )}

      {/* Centered net change line */}
      <Reveal delay={150}>
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              font: '600 14px var(--ui)',
              color: gained ? 'var(--pos-ink)' : 'var(--accent-ink)',
              whiteSpace: 'nowrap',
            }}
          >
            {gained ? (
              <TrendingUpIcon size={16} />
            ) : (
              <TrendingDownIcon size={16} />
            )}
            Net change over the summer: {gained ? '+' : '−'}
            {fmtMoney(Math.abs(summary.delta), { cents: true })}
          </span>
        </div>
      </Reveal>

      {/* Composition chart */}
      {composition.items.length > 0 && composition.total > 0 && (
        <Reveal delay={200}>
          <CompositionCard
            items={composition.items}
            total={composition.total}
          />
        </Reveal>
      )}

      {/* Per account journey */}
      <div>
        <SectionLabel>
          Per account · journey from arrival to projected end
        </SectionLabel>
        {states.length === 0 ? (
          <div
            className="card fx-card"
            style={{
              padding: 24,
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              textAlign: 'center',
              color: 'var(--ink-3)',
              font: '500 13.5px var(--ui)',
            }}
          >
            No accounts yet. Seed them via the database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {states.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <AccountCard
                  account={s}
                  vaultCap={vaultCap}
                  onOpenLedger={() => openLedger(s)}
                  onPayCC={() => openPayDialog(s)}
                  viewMode={viewMode}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {/* Recent transfers */}
      {recentTransfers.length > 0 && (
        <Reveal delay={80}>
          <div>
            <SectionLabel
              right={
                <span
                  style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}
                >
                  Last {recentTransfers.length}
                </span>
              }
            >
              Recent transfers
            </SectionLabel>
            <div
              className="card fx-card"
              style={{
                padding: '4px 0',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
              }}
            >
              {recentTransfers.map((t, i) => (
                <div
                  key={t.id}
                  className="accounts-transfer-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 18px',
                    borderTop:
                      i === 0 ? 'none' : '1px solid var(--hair)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className="accounts-transfer-date"
                    style={{
                      font: '500 12px var(--ui)',
                      color: 'var(--ink-3)',
                      minWidth: 70,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtDate(t.transferred_at, 'short')}
                  </span>
                  <span
                    className="accounts-transfer-names"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      font: '600 13px var(--ui)',
                      color: 'var(--ink-1)',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {accountNameById.get(t.from_account_id) ?? 'Account'}
                    </span>
                    <ArrowRightIcon
                      size={13}
                      style={{ color: 'var(--ink-4)', flex: 'none' }}
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {accountNameById.get(t.to_account_id) ?? 'Account'}
                    </span>
                  </span>
                  <Pill tone={transferKindTone(t.kind)}>
                    {transferKindLabel(t.kind)}
                  </Pill>
                  <span
                    className="accounts-transfer-amount"
                    style={{
                      font: '600 13.5px var(--display)',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 80,
                      textAlign: 'right',
                    }}
                  >
                    {fmtMoney(t.amount, { cents: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Log a transfer dialog */}
      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          if (!open) closeTransferDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a transfer</DialogTitle>
            <DialogDescription>
              Record a manual transfer you already made between two accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-date">Date</Label>
              <Input
                id="transfer-date"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                disabled={transferPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-from">From account</Label>
              <Select
                value={transferFromId}
                onValueChange={(v) => setTransferFromId(String(v ?? ''))}
                disabled={transferPending}
              >
                <SelectTrigger id="transfer-from" className="w-full">
                  <SelectValue placeholder="Pick an account">
                    {(value) =>
                      transferableAccounts.find((a) => a.id === value)?.name ??
                      'Pick an account'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {transferableAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-to">To account</Label>
              <Select
                value={transferToId}
                onValueChange={(v) => setTransferToId(String(v ?? ''))}
                disabled={transferPending}
              >
                <SelectTrigger id="transfer-to" className="w-full">
                  <SelectValue placeholder="Pick an account">
                    {(value) =>
                      transferableAccounts.find((a) => a.id === value)?.name ??
                      'Pick an account'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {transferableAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-amount">Amount</Label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--ink-3)',
                    font: '500 14px var(--ui)',
                    pointerEvents: 'none',
                  }}
                >
                  $
                </span>
                <Input
                  id="transfer-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={transferPending}
                  style={{ paddingLeft: 26 }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfer-note">Note (optional)</Label>
              <Input
                id="transfer-note"
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="What was this transfer for?"
                disabled={transferPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeTransferDialog}
              disabled={transferPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferSubmit}
              disabled={transferPending}
            >
              {transferPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Logging...
                </>
              ) : (
                'Log transfer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit arrival dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit arrival balance</DialogTitle>
            <DialogDescription>
              {editing
                ? `Set the start-of-summer balance for ${editing.name}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-balance">Arrival balance</Label>
            <Input
              id="edit-balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="0.00"
              autoFocus
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Set this to what your account had at the start of the summer.
              Current and projected balances are computed from your paychecks +
              expenses.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay credit card dialog */}
      <Dialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) closePayDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paying
                ? payKind === 'refund_claim'
                  ? `Claim ${paying.name} refund into...`
                  : `Pay ${paying.name} from...`
                : 'Pay credit card'}
            </DialogTitle>
            <DialogDescription>
              {payKind === 'refund_claim'
                ? 'Pull the credit balance back to a checking account. Use when the bank ACHes a credit/refund to your checking.'
                : 'Record a payment from a checking account to this credit card.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <div
                role="radiogroup"
                aria-label="Direction"
                className="accounts-pay-actions"
                style={{
                  display: 'inline-flex',
                  borderRadius: 8,
                  border: '1px solid var(--hair)',
                  overflow: 'hidden',
                  maxWidth: '100%',
                }}
              >
                {(['payment', 'refund_claim'] as const).map((k) => {
                  const active = payKind === k
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPayKind(k)}
                      disabled={payPending}
                      style={{
                        all: 'unset',
                        cursor: payPending ? 'default' : 'pointer',
                        padding: '6px 14px',
                        font: '600 12.5px var(--ui)',
                        color: active
                          ? 'var(--accent-ink)'
                          : 'var(--ink-3)',
                        background: active
                          ? 'color-mix(in oklch, var(--accent) 14%, transparent)'
                          : 'transparent',
                      }}
                    >
                      {k === 'payment' ? 'Pay down balance' : 'Claim refund'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-from">
                {payKind === 'refund_claim' ? 'Deposit to' : 'From account'}
              </Label>
              <Select
                value={payFromId}
                onValueChange={(v) => setPayFromId(String(v ?? ''))}
                disabled={payPending}
              >
                <SelectTrigger id="pay-from" className="w-full">
                  <SelectValue placeholder="Pick an account">
                    {(value) => {
                      const acct = checkingAccounts.find((a) => a.id === value)
                      return acct ? acct.name : 'Pick an account'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {checkingAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount</Label>
              <Input
                id="pay-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
                disabled={payPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                disabled={payPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePayDialog}
              disabled={payPending}
            >
              Cancel
            </Button>
            <Button onClick={handlePaySubmit} disabled={payPending}>
              {payPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  {payKind === 'refund_claim' ? 'Claiming...' : 'Paying...'}
                </>
              ) : (
                `${payKind === 'refund_claim' ? 'Claim' : 'Pay'} ${moneyFmt.format(parseFloat(payAmount) || 0)}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Net worth customization dialog */}
      <Dialog
        open={netWorthOpen}
        onOpenChange={(open) => {
          if (!open && !netWorthSaving) setNetWorthOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize net worth</DialogTitle>
            <DialogDescription>
              Pick the accounts that count toward your net worth. Toggles
              persist across devices.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {states.map((s) => {
              const checked = netWorthDraft[s.id] ?? true
              const isCC = s.type === 'credit_card'
              return (
                <label
                  key={s.id}
                  htmlFor={`nw-${s.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--hair)',
                    background: checked
                      ? 'color-mix(in oklch, var(--accent) 7%, transparent)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  <Checkbox
                    id={`nw-${s.id}`}
                    checked={checked}
                    onCheckedChange={() => toggleNetWorthDraft(s.id)}
                    disabled={netWorthSaving}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: '600 14px var(--ui)',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        font: '500 11.5px var(--ui)',
                        color: 'var(--ink-3)',
                        marginTop: 2,
                      }}
                    >
                      {typeLabel(s.type)} · current{' '}
                      {fmtMoney(s.current, { cents: true })}
                    </div>
                  </div>
                  <span
                    style={{
                      font: '600 13px var(--display)',
                      color: isCC ? 'var(--accent-ink)' : 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {isCC && s.current > 0 ? '-' : ''}
                    {fmtMoney(s.current, { cents: true })}
                  </span>
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNetWorthOpen(false)}
              disabled={netWorthSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveNetWorthSelections} disabled={netWorthSaving}>
              {netWorthSaving ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save selection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-account ledger dialog */}
      <Dialog
        open={ledgerAccount !== null}
        onOpenChange={(open) => {
          if (!open && !ledgerSaving) closeLedger()
        }}
      >
        <DialogContent
          className="sm:max-w-[720px]"
          style={{
            width: '100%',
            maxWidth: 'min(720px, calc(100% - 2rem))',
            maxHeight: 'calc(100vh - 4rem)',
            overflowY: 'auto',
          }}
        >
          <DialogHeader>
            <DialogTitle
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                lineHeight: 1.2,
              }}
            >
              {ledgerAccount?.name ?? 'Ledger'}
              {ledgerAccount && (
                <span
                  style={{
                    font: '600 11px var(--ui)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: `color-mix(in oklch, oklch(0.62 0.16 ${hueForAccount(ledgerAccount.name, ledgerAccount.type, ledgerAccount.is_vault)}) 16%, transparent)`,
                    color: `oklch(0.62 0.16 ${hueForAccount(ledgerAccount.name, ledgerAccount.type, ledgerAccount.is_vault)})`,
                  }}
                >
                  {typeLabel(ledgerAccount.type)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Chronological ledger derived from paychecks, expenses, transfers,
              CC payments, and any manual entries you add.
            </DialogDescription>
          </DialogHeader>

          {ledgerAccount && (
            <>
              {/* Summary row: arrival / now / projected. Credit cards drop the
                  PROJECTED column because the projection isn't actionable for
                  a balance the user pays down on their own cadence. The two
                  remaining cells get more breathing room. */}
              <div
                className={`accounts-ledger-stats${ledgerAccount.type === 'credit_card' ? ' accounts-ledger-stats--credit' : ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    ledgerAccount.type === 'credit_card'
                      ? 'repeat(2, minmax(180px, 1fr))'
                      : 'repeat(3, minmax(0, 1fr))',
                  gap: ledgerAccount.type === 'credit_card' ? 18 : 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--hair)',
                  background: 'var(--surface-2, var(--surface))',
                }}
              >
                <LedgerStat label="Arrival" value={ledgerAccount.arrival} />
                <LedgerStat
                  label="Right now"
                  value={ledgerAccount.current}
                  emphasis
                />
                {ledgerAccount.type !== 'credit_card' && (
                  <LedgerStat
                    label="Projected"
                    value={ledgerAccount.projected}
                  />
                )}
              </div>

              {/* Ledger table - scrolls inside vertically + horizontally on phone */}
              <div
                style={{
                  maxHeight: 360,
                  overflowY: 'auto',
                  overflowX: 'auto',
                  border: '1px solid var(--hair)',
                  borderRadius: 12,
                }}
              >
                <table
                  className="accounts-ledger-table"
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: 'var(--surface)',
                      zIndex: 1,
                    }}
                  >
                    <tr>
                      <LedgerTh>Date</LedgerTh>
                      <LedgerTh>Source</LedgerTh>
                      <LedgerTh>Description</LedgerTh>
                      <LedgerTh align="right">Amount</LedgerTh>
                      <LedgerTh align="right">Running</LedgerTh>
                      <LedgerTh align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: '20px 14px',
                            textAlign: 'center',
                            color: 'var(--ink-3)',
                            font: '500 13px var(--ui)',
                          }}
                        >
                          No activity yet.
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((row) => {
                        const isOverridable =
                          (row.source === 'vault_transfer' ||
                            row.source === 'rent_payment' ||
                            row.source === 'robinhood_transfer') &&
                          row.paycheckId &&
                          row.overrideKind
                        const overrideSavingThis =
                          overrideSavingKey === row.key
                        return (
                        <tr
                          key={row.key}
                          style={{
                            borderTop: '1px solid var(--hair)',
                          }}
                        >
                          <LedgerTd>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span
                                style={{
                                  font: '500 12px var(--ui)',
                                  color: 'var(--ink-3)',
                                }}
                              >
                                {fmtDate(row.date, 'short')}
                              </span>
                              {row.hasOverride && (
                                <span
                                  style={{
                                    font: '400 10.5px var(--ui)',
                                    fontStyle: 'italic',
                                    color: 'var(--ink-4)',
                                  }}
                                  title="Date moved off the paycheck date"
                                >
                                  edited
                                </span>
                              )}
                            </div>
                          </LedgerTd>
                          <LedgerTd>
                            <LedgerSourcePill source={row.source} />
                          </LedgerTd>
                          <LedgerTd>
                            {row.source === 'expense' ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                  alignItems: 'flex-start',
                                }}
                              >
                                <span
                                  style={{
                                    font: '500 13px var(--ui)',
                                    color: 'var(--ink-1)',
                                  }}
                                >
                                  {row.description}
                                </span>
                                {row.category && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      font: '600 10.5px var(--ui)',
                                      letterSpacing: '.02em',
                                      padding: '2px 7px',
                                      borderRadius: 5,
                                      background: `oklch(0.7 0.2 ${hueForCategory(row.category)} / 0.18)`,
                                      color: `oklch(0.78 0.2 ${hueForCategory(row.category)})`,
                                    }}
                                  >
                                    {row.category}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  font: '500 13px var(--ui)',
                                  color: 'var(--ink-1)',
                                }}
                              >
                                {row.description}
                              </span>
                            )}
                          </LedgerTd>
                          <LedgerTd align="right">
                            <span
                              style={{
                                font: '600 13px var(--display)',
                                color:
                                  row.amount >= 0
                                    ? 'var(--pos-ink)'
                                    : 'var(--accent-ink)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.amount >= 0 ? '+' : '−'}
                              {fmtMoney(Math.abs(row.amount), { cents: true })}
                            </span>
                          </LedgerTd>
                          <LedgerTd align="right">
                            <span
                              style={{
                                font: '600 13px var(--display)',
                                color: 'var(--ink-2)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fmtMoney(row.runningBalance, { cents: true })}
                            </span>
                          </LedgerTd>
                          <LedgerTd align="right">
                            {isOverridable && row.paycheckId && row.overrideKind ? (
                              <Popover
                                open={overridePopoverKey === row.key}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setOverridePopoverKey(row.key)
                                    setOverrideDateDraft(row.date)
                                  } else if (!overrideSavingThis) {
                                    setOverridePopoverKey(null)
                                  }
                                }}
                              >
                                <PopoverTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Edit date"
                                      disabled={overrideSavingThis}
                                    />
                                  }
                                >
                                  {overrideSavingThis ? (
                                    <Loader2Icon className="size-4 animate-spin" />
                                  ) : (
                                    <PencilIcon className="size-4" />
                                  )}
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  className="w-64"
                                >
                                  <div
                                    style={{
                                      font: '600 11px var(--ui)',
                                      letterSpacing: '.05em',
                                      textTransform: 'uppercase',
                                      color: 'var(--ink-3)',
                                    }}
                                  >
                                    Move this entry
                                  </div>
                                  <div className="space-y-2">
                                    <Label
                                      htmlFor={`override-date-${row.key}`}
                                    >
                                      Effective date
                                    </Label>
                                    <Input
                                      id={`override-date-${row.key}`}
                                      type="date"
                                      value={overrideDateDraft}
                                      onChange={(e) =>
                                        setOverrideDateDraft(e.target.value)
                                      }
                                      disabled={overrideSavingThis}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: 6,
                                      justifyContent: 'space-between',
                                      marginTop: 4,
                                    }}
                                  >
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        row.paycheckId &&
                                        row.overrideKind &&
                                        handleResetFlowOverride(
                                          row.key,
                                          row.paycheckId,
                                          row.overrideKind,
                                        )
                                      }
                                      disabled={
                                        overrideSavingThis || !row.hasOverride
                                      }
                                    >
                                      Reset
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        row.paycheckId &&
                                        row.overrideKind &&
                                        handleSaveFlowOverride(
                                          row.key,
                                          row.paycheckId,
                                          row.overrideKind,
                                          overrideDateDraft,
                                        )
                                      }
                                      disabled={overrideSavingThis}
                                    >
                                      {overrideSavingThis ? (
                                        <>
                                          <Loader2Icon className="size-4 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        'Save'
                                      )}
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : row.source === 'manual' && row.manualId && !viewMode ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  gap: 2,
                                  justifyContent: 'flex-end',
                                }}
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Edit entry"
                                  disabled={
                                    ledgerSaving ||
                                    ledgerDeletingId === row.manualId
                                  }
                                  onClick={() =>
                                    row.manualId &&
                                    startLedgerEdit(row.manualId)
                                  }
                                >
                                  <PencilIcon className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Delete entry"
                                  disabled={ledgerDeletingId === row.manualId}
                                  onClick={() =>
                                    row.manualId &&
                                    handleLedgerDelete(row.manualId)
                                  }
                                >
                                  {ledgerDeletingId === row.manualId ? (
                                    <Loader2Icon className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2Icon className="size-4" />
                                  )}
                                </Button>
                              </div>
                            ) : null}
                          </LedgerTd>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add-entry form, expanded inline */}
              {ledgerFormOpen && !viewMode ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid var(--hair)',
                    background: 'var(--surface)',
                  }}
                >
                  <div
                    style={{
                      font: '600 13px var(--ui)',
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {ledgerEditingId ? 'Edit entry' : 'Add entry'}
                  </div>
                  <div
                    className="accounts-ledger-form-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="ledger-date">Date</Label>
                      <Input
                        id="ledger-date"
                        type="date"
                        value={ledgerDate}
                        onChange={(e) => setLedgerDate(e.target.value)}
                        disabled={ledgerSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Direction</Label>
                      <div
                        role="radiogroup"
                        aria-label="Direction"
                        style={{
                          display: 'inline-flex',
                          borderRadius: 8,
                          border: '1px solid var(--hair)',
                          overflow: 'hidden',
                          maxWidth: '100%',
                        }}
                      >
                        {(['in', 'out'] as const).map((dir) => {
                          const active = ledgerDirection === dir
                          return (
                            <button
                              key={dir}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setLedgerDirection(dir)}
                              disabled={ledgerSaving}
                              style={{
                                all: 'unset',
                                cursor: ledgerSaving ? 'default' : 'pointer',
                                padding: '6px 14px',
                                font: '600 12.5px var(--ui)',
                                color: active
                                  ? dir === 'in'
                                    ? 'var(--pos-ink)'
                                    : 'var(--accent-ink)'
                                  : 'var(--ink-3)',
                                background: active
                                  ? dir === 'in'
                                    ? 'color-mix(in oklch, var(--pos) 12%, transparent)'
                                    : 'color-mix(in oklch, var(--accent) 12%, transparent)'
                                  : 'transparent',
                              }}
                            >
                              {dir === 'in' ? 'Money in' : 'Money out'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ledger-amount">Amount</Label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--ink-3)',
                          font: '500 14px var(--ui)',
                          pointerEvents: 'none',
                        }}
                      >
                        $
                      </span>
                      <Input
                        id="ledger-amount"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={ledgerAmount}
                        onChange={(e) => setLedgerAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={ledgerSaving}
                        style={{ paddingLeft: 26 }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ledger-description">Description</Label>
                    <Input
                      id="ledger-description"
                      type="text"
                      value={ledgerDescription}
                      onChange={(e) => setLedgerDescription(e.target.value)}
                      placeholder="What was this entry for?"
                      disabled={ledgerSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category (optional)</Label>
                    <Select
                      value={ledgerCategory || '__none'}
                      onValueChange={(v) =>
                        setLedgerCategory(v === '__none' ? '' : String(v))
                      }
                      disabled={ledgerSaving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">
                          <span style={{ color: 'var(--ink-3)' }}>
                            No category
                          </span>
                        </SelectItem>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ledger-note">Note (optional)</Label>
                    <Input
                      id="ledger-note"
                      type="text"
                      value={ledgerNote}
                      onChange={(e) => setLedgerNote(e.target.value)}
                      placeholder="Anything to remember about this entry?"
                      disabled={ledgerSaving}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLedgerFormOpen(false)
                        resetLedgerForm()
                      }}
                      disabled={ledgerSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleLedgerSubmit}
                      disabled={ledgerSaving}
                    >
                      {ledgerSaving ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Saving...
                        </>
                      ) : ledgerEditingId ? (
                        'Save changes'
                      ) : (
                        'Save entry'
                      )}
                    </Button>
                  </div>
                </div>
              ) : !viewMode ? (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLedgerFormOpen(true)}
                  >
                    <PlusIcon className="size-4" />
                    Add entry
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @media (max-width: 640px) {
          .accounts-netcards-grid {
            grid-template-columns: 1fr !important;
          }
          .accounts-transfer-row {
            padding: 12px 14px !important;
            row-gap: 6px !important;
          }
          .accounts-transfer-names {
            order: 2;
            flex-basis: 100% !important;
          }
          .accounts-transfer-amount {
            margin-left: auto;
          }
          .accounts-account-card {
            padding: 16px !important;
          }
          .accounts-account-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .accounts-account-stages {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .accounts-account-stages--credit {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .accounts-account-actions {
            justify-self: stretch !important;
            justify-content: space-between !important;
            width: 100%;
          }
          .accounts-composition-card {
            padding: 16px !important;
          }
          .accounts-composition-row {
            flex-direction: column !important;
            gap: 18px !important;
            align-items: stretch !important;
          }
          .accounts-composition-legend {
            min-width: 0 !important;
            width: 100% !important;
          }
          .accounts-ledger-stats {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .accounts-ledger-stats--credit {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .accounts-ledger-form-row {
            grid-template-columns: 1fr !important;
          }
          .accounts-pay-actions {
            flex-wrap: wrap !important;
          }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .accounts-account-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .accounts-account-stages {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 14px !important;
          }
          .accounts-account-stages--credit {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .accounts-account-actions {
            justify-self: stretch !important;
            justify-content: flex-end !important;
          }
        }
        @media (max-width: 640px) {
          .accounts-ledger-table {
            min-width: 560px;
          }
        }
      `}</style>
    </div>
  )
}

function LedgerStat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          font: '600 10.5px var(--ui)',
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: `600 ${emphasis ? 20 : 16}px var(--display)`,
          color: emphasis ? 'var(--ink-1)' : 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtMoney(value, { cents: true })}
      </div>
    </div>
  )
}

function LedgerTh({
  children,
  align,
}: {
  children?: React.ReactNode
  align?: 'right'
}) {
  return (
    <th
      style={{
        padding: '10px 14px',
        textAlign: align ?? 'left',
        font: '600 11px var(--ui)',
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        borderBottom: '1px solid var(--hair)',
      }}
    >
      {children}
    </th>
  )
}

function LedgerTd({
  children,
  align,
}: {
  children?: React.ReactNode
  align?: 'right'
}) {
  return (
    <td
      style={{
        padding: '10px 14px',
        textAlign: align ?? 'left',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}

function LedgerSourcePill({ source }: { source: LedgerSource }) {
  // Per-source soft tints + readable label. Manual entries get a neutral
  // "Manual" label so users can distinguish their hand-added rows. The
  // vault/rent/robinhood splits each pick up the same hue used elsewhere
  // in the app (Vault = accent violet, Rent = gold, Robinhood = mint) so
  // the ledger reads consistently with the dashboard donut + tags.
  const styleMap: Record<
    LedgerSource,
    { bg: string; fg: string; label: string }
  > = {
    arrival: {
      bg: 'color-mix(in oklch, var(--gold) 18%, transparent)',
      fg: 'var(--gold-ink, oklch(0.55 0.13 80))',
      label: 'Arrival',
    },
    paycheck: {
      bg: 'color-mix(in oklch, var(--pos) 14%, transparent)',
      fg: 'var(--pos-ink)',
      label: 'Paycheck',
    },
    vault_transfer: {
      bg: 'color-mix(in oklch, oklch(0.62 0.16 285) 16%, transparent)',
      fg: 'oklch(0.62 0.16 285)',
      label: 'Vault',
    },
    rent_payment: {
      bg: 'color-mix(in oklch, oklch(0.62 0.16 35) 16%, transparent)',
      fg: 'oklch(0.62 0.16 35)',
      label: 'Rent',
    },
    robinhood_transfer: {
      bg: 'color-mix(in oklch, oklch(0.62 0.16 150) 16%, transparent)',
      fg: 'oklch(0.62 0.16 150)',
      label: 'Robinhood',
    },
    expense: {
      bg: 'color-mix(in oklch, var(--accent) 14%, transparent)',
      fg: 'var(--accent-ink)',
      label: 'Expense',
    },
    cc_payment: {
      bg: 'color-mix(in oklch, var(--mint) 18%, transparent)',
      fg: 'var(--mint-ink)',
      label: 'CC payment',
    },
    transfer: {
      bg: 'color-mix(in oklch, var(--ink-3) 14%, transparent)',
      fg: 'var(--ink-2)',
      label: 'Transfer',
    },
    manual: {
      bg: 'color-mix(in oklch, var(--ink-2) 12%, transparent)',
      fg: 'var(--ink-2)',
      label: 'Manual',
    },
  }
  const s = styleMap[source]
  return (
    <span
      style={{
        display: 'inline-block',
        font: '600 11px var(--ui)',
        padding: '2px 8px',
        borderRadius: 6,
        background: s.bg,
        color: s.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

function NetWorthCardButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  if (!onClick) {
    return (
      <div style={{ display: 'block', height: '100%', width: '100%' }}>
        {children}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Customize net worth"
      style={{
        all: 'unset',
        display: 'block',
        height: '100%',
        width: '100%',
        cursor: 'pointer',
        borderRadius: 'var(--radius)',
      }}
    >
      {children}
    </button>
  )
}

type NetCardProps = {
  label: string
  sub: string
  value: number
  big?: boolean
  accent?: boolean
}

function NetCard({ label, sub, value, big, accent }: NetCardProps) {
  return (
    <div
      className="card fx-card"
      style={{
        padding: 20,
        height: '100%',
        borderRadius: 'var(--radius)',
        border: accent
          ? '1px solid color-mix(in oklch, var(--pos) 40%, var(--hair))'
          : '1px solid var(--hair)',
        background: accent
          ? 'color-mix(in oklch, var(--pos) 7%, var(--surface))'
          : 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          font: '600 11px var(--ui)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: '500 12.5px var(--ui)',
          color: 'var(--ink-3)',
          marginBottom: 8,
        }}
      >
        {sub}
      </div>
      <div
        style={{
          font: `600 ${big ? 34 : 30}px/1 var(--display)`,
          letterSpacing: '-.02em',
          color: accent ? 'var(--pos-ink)' : 'var(--ink-1)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Money value={value} cents dur={1300} />
      </div>
    </div>
  )
}

type CompositionCardProps = {
  items: { label: string; hue: number; total: number }[]
  total: number
}

function CompositionCard({ items, total }: CompositionCardProps) {
  return (
    <div
      className="card fx-card accounts-composition-card"
      style={{
        padding: 22,
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SectionLabel
        right={
          <span style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>
            {fmtMoney(total)} in assets
          </span>
        }
      >
        Composition right now
      </SectionLabel>
      <div
        className="accounts-composition-row"
        style={{
          display: 'flex',
          gap: 28,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          flex: 1,
        }}
      >
        <Donut
          data={items}
          size={170}
          stroke={26}
          tooltipContent={(d, pct) => (
            <div style={{ minWidth: 110, textAlign: 'center' }}>
              <div
                style={{
                  font: '600 12px var(--ui)',
                  color: 'var(--ink-1)',
                  marginBottom: 2,
                }}
              >
                {d.label}
              </div>
              <div
                style={{
                  font: '600 16px var(--display)',
                  color: 'var(--ink-1)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(d.total, { cents: true })}
              </div>
              <div
                style={{
                  font: '500 11px var(--ui)',
                  color: 'var(--ink-3)',
                  marginTop: 2,
                }}
              >
                {(pct * 100).toFixed(1)}%
              </div>
            </div>
          )}
        />
        <div
          className="accounts-composition-legend"
          style={{
            flex: 1,
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {items.map((c) => (
            <div
              key={c.label}
              style={{ display: 'flex', alignItems: 'center', gap: 11 }}
            >
              <CatDot hue={c.hue} />
              <span
                style={{
                  flex: 1,
                  font: '600 13.5px var(--ui)',
                  color: 'var(--ink-1)',
                }}
              >
                {c.label}
              </span>
              <span
                style={{
                  font: '600 13.5px var(--display)',
                  color: 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(c.total, { cents: true })}
              </span>
              <span
                style={{
                  width: 42,
                  textAlign: 'right',
                  font: '500 12.5px var(--ui)',
                  color: 'var(--ink-3)',
                }}
              >
                {Math.round((c.total / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type AccountCardProps = {
  account: AccountStateRow
  vaultCap: number
  onOpenLedger: () => void
  onPayCC: () => void
  viewMode?: boolean
}

function AccountCard({
  account,
  vaultCap,
  onOpenLedger,
  onPayCC,
  viewMode,
}: AccountCardProps) {
  const isCredit = account.type === 'credit_card'
  const isVault = account.is_vault
  const delta = account.projected - account.current
  const goalActive = isVault && vaultCap > 0
  const goalPct = goalActive
    ? Math.max(0, Math.min(1, account.current / vaultCap))
    : 0

  const tags: string[] = []
  tags.push(typeLabel(account.type))
  if (account.is_paycheck_destination) tags.push('Paycheck')
  if (isVault && account.type !== 'hysa') tags.push('Vault')

  return (
    <div
      className="card fx-card accounts-account-card"
      role="button"
      tabIndex={0}
      onClick={onOpenLedger}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenLedger()
        }
      }}
      aria-label={`Open ledger for ${account.name}`}
      style={{
        padding: '18px 24px',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        cursor: 'pointer',
      }}
    >
      <div
        className="accounts-account-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: isCredit
            ? 'minmax(220px,1.6fr) 1fr 1fr auto'
            : 'minmax(220px,1.5fr) 1fr 1fr 1fr auto',
          gap: 18,
          alignItems: 'center',
        }}
      >
        {/* Identity + optional goal bar */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                font: '600 16px var(--ui)',
                color: 'var(--ink-1)',
              }}
            >
              {account.name}
            </span>
            {tags.map((t) => {
              const hue = hueForTag(t)
              return (
                <span
                  key={t}
                  style={{
                    font: '600 11px var(--ui)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: `color-mix(in oklch, oklch(0.62 0.16 ${hue}) 16%, transparent)`,
                    color: `oklch(0.62 0.16 ${hue})`,
                  }}
                >
                  {t}
                </span>
              )
            })}
          </div>
          {isCredit && (
            <div
              style={{
                font: '500 12px var(--ui)',
                color: 'var(--ink-4)',
                marginTop: 6,
              }}
            >
              Outstanding balance
            </div>
          )}
          {goalActive && (
            <div style={{ marginTop: 13 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  font: '500 11.5px var(--ui)',
                  color: 'var(--ink-3)',
                  marginBottom: 6,
                }}
              >
                <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
                  {(goalPct * 100).toFixed(1)}% funded
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(account.current, { cents: true })} /{' '}
                  {fmtMoney(vaultCap)}
                </span>
              </div>
              <ProgressBar pct={goalPct} />
            </div>
          )}
        </div>

        <div
          className={`accounts-account-stages${isCredit ? ' accounts-account-stages--credit' : ''}`}
          style={{ display: 'contents' }}
        >
          <Stage label="At arrival" value={account.arrival} />
          <Stage
            label="Right now"
            value={account.current}
            big
            credit={isCredit}
          />
          {!isCredit && (
            <Stage label="Projected end" value={account.projected} delta={delta} />
          )}
        </div>

        <div
          className="accounts-account-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifySelf: 'end',
          }}
        >
          {isCredit && !viewMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onPayCC()
              }}
            >
              <CreditCardIcon className="size-4" />
              Pay credit card
            </Button>
          )}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
              color: 'var(--accent)',
            }}
            title="Open ledger"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </div>
  )
}

type StageProps = {
  label: string
  value: number
  big?: boolean
  delta?: number
  credit?: boolean
}

function Stage({ label, value, big, delta, credit }: StageProps) {
  const gained = (delta ?? 0) > 0
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          font: '600 10.5px var(--ui)',
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: `600 ${big ? 24 : 16}px var(--display)`,
          letterSpacing: big ? '-.02em' : 0,
          color: credit
            ? 'var(--accent-ink)'
            : big
              ? 'var(--ink-1)'
              : 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Money value={value} cents dur={big ? 1200 : 900} />
      </div>
      {delta != null && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 5,
            font: '600 11.5px var(--ui)',
            color: gained ? 'var(--pos-ink)' : 'var(--ink-4)',
          }}
        >
          {gained ? (
            <TrendingUpIcon size={12} />
          ) : (
            <TrendingDownIcon size={12} />
          )}
          {delta > 0 ? '+' : ''}
          {fmtMoney(delta)} from now
        </div>
      )}
    </div>
  )
}

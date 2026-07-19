'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, endOfWeek, startOfWeek } from 'date-fns'
import {
  Check,
  CircleDashed,
  Loader2Icon,
  Pencil,
  Receipt,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import type { Expense } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Money, Reveal, fmtMoney } from '@/components/redesign'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteExpense,
  setExpenseBudgetKind,
  setExpenseRefundSettled,
  updateExpense,
} from './expense-actions'
import { classifyBudgetKind, type BudgetKind } from './budget-kind'
import type { AccountOption } from './add-expense-form'
import { ExpenseCharts } from './expense-charts'
import { useViewMode } from '@/components/view-mode-context'
import { EXPENSE_CATEGORIES, hueForCategory } from './categories'

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Compress a long account name into a chip-friendly short label. */
function shortAccountLabel(name: string, type: AccountOption['type']): string {
  if (type === 'credit_card') {
    const stripped = name.replace(/credit card/i, '').trim()
    return `${stripped || name} CC`.replace(/\s+/g, ' ')
  }
  if (type === 'hysa') {
    return name
  }
  return name.replace(/checking/i, '').trim() || name
}

interface WeekGroup {
  key: string
  start: Date
  end: Date
  expenses: Expense[]
  total: number
}

function groupByWeek(expenses: Expense[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>()
  for (const e of expenses) {
    const d = parseLocalDate(e.expense_date)
    const end = endOfWeek(d, { weekStartsOn: 1 })
    const key = format(end, 'yyyy-MM-dd')
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        start: startOfWeek(d, { weekStartsOn: 1 }),
        end,
        expenses: [],
        total: 0,
      }
      map.set(key, g)
    }
    g.expenses.push(e)
    g.total += e.amount
  }
  return Array.from(map.values()).sort((a, b) =>
    a.key < b.key ? 1 : a.key > b.key ? -1 : 0,
  )
}

interface Props {
  expenses: Expense[]
  accounts: AccountOption[]
  cumMaxAllowed: number
  cumSpent: number
  pendingRefundTotal: number
  settledRefundTotal: number
}

export function ExpenseList({
  expenses,
  accounts,
  cumMaxAllowed,
  cumSpent,
  pendingRefundTotal,
  settledRefundTotal,
}: Props) {
  const router = useRouter()
  const viewMode = useViewMode()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const [deleting, startDeleting] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Edit dialog state. `editing` doubles as the open flag (truthy = open)
  // and the source of pre-fill values for the form.
  const [editing, setEditing] = useState<Expense | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAccountId, setEditAccountId] = useState('')
  const [editBudgetKind, setEditBudgetKind] = useState<BudgetKind>('co')
  const [editRefundExpected, setEditRefundExpected] = useState('')
  const [editRefundSettled, setEditRefundSettled] = useState(false)
  const [editPending, startEditTransition] = useTransition()
  const [refundTogglingId, setRefundTogglingId] = useState<string | null>(null)

  function openEdit(e: Expense) {
    setEditing(e)
    setEditDate(e.expense_date)
    setEditDescription(e.description)
    setEditAmount(String(e.amount))
    setEditCategory(e.category || EXPENSE_CATEGORIES[0].id)
    setEditAccountId(e.account_id ?? '')
    setEditBudgetKind(classifyBudgetKind(e))
    setEditRefundExpected(
      e.refund_expected != null ? String(e.refund_expected) : '',
    )
    setEditRefundSettled(e.refund_settled ?? false)
  }

  function handleSaveEdit() {
    if (!editing) return
    const amt = parseFloat(editAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!editDescription.trim()) {
      toast.error('Description required')
      return
    }
    if (!editAccountId) {
      toast.error('Pick an account')
      return
    }
    const id = editing.id
    const refundRaw = editRefundExpected.trim()
    const refundNum = refundRaw ? parseFloat(refundRaw) : null
    if (refundNum != null && (!Number.isFinite(refundNum) || refundNum < 0)) {
      toast.error('Invalid refund amount')
      return
    }
    if (refundNum != null && refundNum > amt) {
      toast.error('Refund cannot exceed the expense amount')
      return
    }
    startEditTransition(async () => {
      const res = await updateExpense({
        id,
        expense_date: editDate,
        description: editDescription,
        amount: amt,
        category: editCategory,
        account_id: editAccountId,
        budget_kind: editBudgetKind,
        refund_expected: refundNum && refundNum > 0 ? refundNum : null,
        refund_settled: refundNum && refundNum > 0 ? editRefundSettled : false,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update')
        return
      }
      toast.success('Expense updated')
      setEditing(null)
      router.refresh()
    })
  }

  async function handleToggleRefundSettled(e: Expense) {
    if ((e.refund_expected ?? 0) <= 0) return
    setRefundTogglingId(e.id)
    const res = await setExpenseRefundSettled(e.id, !e.refund_settled)
    setRefundTogglingId(null)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not update refund')
      return
    }
    toast.success(
      !e.refund_settled ? 'Refund marked received' : 'Refund marked pending',
    )
    router.refresh()
  }

  async function handleCycleBudgetKind(e: Expense) {
    // Inline cycle: co → reimbursable → personal → co. The edit dialog has the
    // explicit 3-way radio for when the user wants to skip a step.
    const current = classifyBudgetKind(e)
    const next: BudgetKind =
      current === 'co'
        ? 'reimbursable'
        : current === 'reimbursable'
          ? 'personal'
          : 'co'
    setTogglingId(e.id)
    const res = await setExpenseBudgetKind(e.id, next)
    setTogglingId(null)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not update')
      return
    }
    toast.success(
      next === 'co'
        ? 'Back in CO budget'
        : next === 'reimbursable'
          ? 'Marked reimbursable'
          : 'Marked off-budget',
    )
    router.refresh()
  }

  const groups = useMemo(() => groupByWeek(expenses), [expenses])

  const accountById = useMemo(() => {
    const m = new Map<string, AccountOption>()
    for (const a of accounts) m.set(a.id, a)
    return m
  }, [accounts])

  const remaining = cumMaxAllowed - cumSpent
  const isUnder = remaining >= 0
  const accentInk = isUnder ? 'var(--pos-ink)' : 'oklch(0.65 0.2 27)'
  // Fill grows left -> right as money is spent. Clamped 0-100 so even an
  // over-budget month maxes the bar instead of overflowing the card.
  const fillPct =
    cumMaxAllowed > 0
      ? Math.min(100, Math.max(0, (cumSpent / cumMaxAllowed) * 100))
      : 0
  const fillColor = isUnder
    ? 'color-mix(in oklch, var(--pos) 22%, transparent)'
    : 'color-mix(in oklch, oklch(0.62 0.23 27) 26%, transparent)'

  function handleDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDeleting(async () => {
      const res = await deleteExpense(id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete')
        return
      }
      toast.success('Expense deleted')
      setPendingDelete(null)
      router.refresh()
    })
  }

  return (
    <div>
      <Reveal delay={60}>
        <Card
          className="mb-4"
          style={{
            padding: '16px 20px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: `${fillPct}%`,
              background: fillColor,
              transition:
                'width 1100ms cubic-bezier(.22,1,.36,1), background 300ms ease',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <CardContent
            style={{
              padding: 0,
              width: '100%',
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <span
              style={{
                font: '600 26px/1 var(--display)',
                letterSpacing: '-.02em',
                color: accentInk,
              }}
            >
              <Money value={Math.abs(remaining)} cents dur={900} />
            </span>
            <span
              style={{
                font: '500 14px var(--ui)',
                color: 'var(--ink-2)',
              }}
            >
              {isUnder ? 'left to spend overall' : 'over budget overall'}
            </span>
            <span
              className="budget-summary-meta"
              style={{
                marginLeft: 'auto',
                font: '500 12.5px var(--ui)',
                color: 'var(--ink-3)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Spent {fmtMoney(cumSpent, { cents: true })} · Maximum allowed{' '}
              {fmtMoney(cumMaxAllowed, { cents: true })}
            </span>
          </CardContent>
        </Card>
      </Reveal>

      {(pendingRefundTotal > 0 || settledRefundTotal > 0) && (
        <Reveal delay={70}>
          <Card
            className="mb-4"
            style={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <CardContent
              style={{
                padding: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'baseline',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  font: '600 11.5px var(--ui)',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Pending card refunds
              </span>
              <span
                style={{
                  font: '600 18px var(--display)',
                  color: 'var(--ink-1)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtMoney(pendingRefundTotal, { cents: true })}
              </span>
              {settledRefundTotal > 0 && (
                <span
                  style={{
                    font: '500 12px var(--ui)',
                    color: 'var(--ink-3)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  · {fmtMoney(settledRefundTotal, { cents: true })} already
                  received
                </span>
              )}
            </CardContent>
          </Card>
        </Reveal>
      )}

      <Reveal delay={80}>
        <ExpenseCharts expenses={expenses} />
      </Reveal>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {groups.length === 0 ? (
          <Reveal delay={100}>
            <Card>
              <CardContent
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '40px 16px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    display: 'grid',
                    placeItems: 'center',
                    background:
                      'color-mix(in oklch, var(--accent) 16%, transparent)',
                    color: 'var(--accent)',
                  }}
                >
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p
                    style={{
                      font: '600 14px var(--ui)',
                      color: 'var(--ink-1)',
                      margin: 0,
                    }}
                  >
                    No expenses yet
                  </p>
                  <p
                    style={{
                      font: '400 12.5px var(--ui)',
                      color: 'var(--ink-3)',
                      margin: '4px 0 0',
                    }}
                  >
                    Add your first one with the form above.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        ) : (
          groups.map((g, gi) => (
            <Reveal key={g.key} delay={100 + gi * 40}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                    padding: '0 2px',
                  }}
                >
                  <span
                    style={{
                      font: '600 14px var(--ui)',
                      color: 'var(--ink-1)',
                    }}
                  >
                    Week of {format(g.start, 'MMM d')} – {format(g.end, 'MMM d')}
                  </span>
                  <span
                    style={{
                      font: '600 14px var(--display)',
                      color: 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtMoney(g.total, { cents: true })}
                  </span>
                </div>
                <Card className="expense-week-card" style={{ padding: '4px 16px' }}>
                  <CardContent style={{ padding: 0 }}>
                    {g.expenses.map((e, i) => {
                      const acct = e.account_id
                        ? accountById.get(e.account_id)
                        : undefined
                      const hue = hueForCategory(e.category)
                      const kind = classifyBudgetKind(e)
                      const isOffBudget = kind !== 'co'
                      return (
                        <div
                          key={e.id}
                          className="expense-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '13px 4px',
                            borderTop: i ? '1px solid var(--hair)' : 'none',
                            opacity: isOffBudget ? 0.45 : 1,
                            transition: 'opacity .25s ease',
                          }}
                        >
                          <span
                            className="expense-row-date"
                            style={{
                              width: 64,
                              flex: 'none',
                              font: '500 11.5px var(--ui)',
                              color: 'var(--ink-3)',
                              lineHeight: 1.3,
                            }}
                          >
                            {format(parseLocalDate(e.expense_date), 'EEE MMM d')}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                font: '600 14.5px var(--ui)',
                                color: 'var(--ink-1)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {e.description}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: 7,
                                marginTop: 5,
                                flexWrap: 'wrap',
                              }}
                            >
                              {e.category && (
                                <span
                                  style={{
                                    font: '600 11px var(--ui)',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: `color-mix(in oklch, oklch(0.68 0.2 ${hue}) 22%, transparent)`,
                                    color: `oklch(0.78 0.2 ${hue})`,
                                  }}
                                >
                                  {e.category}
                                </span>
                              )}
                              {kind !== 'co' && (
                                <span
                                  style={{
                                    font: '600 11px var(--ui)',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'var(--surface-2)',
                                    color: 'var(--ink-3)',
                                    border: '1px solid var(--hair)',
                                  }}
                                >
                                  {kind === 'reimbursable'
                                    ? 'Reimbursable'
                                    : 'Off-budget'}
                                </span>
                              )}
                              {(e.refund_expected ?? 0) > 0 && (
                                <span
                                  style={{
                                    font: '600 11px var(--ui)',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: e.refund_settled
                                      ? 'color-mix(in oklch, var(--pos) 22%, transparent)'
                                      : 'color-mix(in oklch, var(--accent) 20%, transparent)',
                                    color: e.refund_settled
                                      ? 'var(--pos-ink)'
                                      : 'var(--accent-ink)',
                                  }}
                                >
                                  {fmtMoney(e.refund_expected!, {
                                    cents: true,
                                  })}{' '}
                                  refund{' '}
                                  {e.refund_settled ? 'received' : 'pending'}
                                </span>
                              )}
                              {acct && (
                                <span
                                  style={{
                                    font: '600 11px var(--ui)',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'var(--surface-2)',
                                    color: 'var(--ink-3)',
                                  }}
                                >
                                  {shortAccountLabel(acct.name, acct.type)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className="expense-row-amount"
                            style={{
                              font: '600 15px var(--display)',
                              color: 'var(--ink-1)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmtMoney(e.amount, { cents: true })}
                          </span>
                          {!viewMode && (
                            <>
                              {(e.refund_expected ?? 0) > 0 && (
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => handleToggleRefundSettled(e)}
                                  disabled={refundTogglingId === e.id}
                                  aria-label={
                                    e.refund_settled
                                      ? 'Mark refund pending'
                                      : 'Mark refund received'
                                  }
                                  title={
                                    e.refund_settled
                                      ? 'Refund received · click to mark pending'
                                      : 'Refund pending · click to mark received'
                                  }
                                  style={{
                                    color: e.refund_settled
                                      ? 'var(--pos-ink)'
                                      : 'var(--ink-4)',
                                  }}
                                >
                                  {refundTogglingId === e.id ? (
                                    <Loader2Icon className="size-4 animate-spin" />
                                  ) : e.refund_settled ? (
                                    <Check className="size-4" />
                                  ) : (
                                    <CircleDashed className="size-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleCycleBudgetKind(e)}
                                disabled={togglingId === e.id}
                                aria-label="Cycle budget treatment"
                                title={
                                  kind === 'co'
                                    ? 'In CO budget · click to mark Reimbursable'
                                    : kind === 'reimbursable'
                                      ? 'Reimbursable · click to mark Off-budget'
                                      : 'Off-budget · click to put back in CO budget'
                                }
                                style={{
                                  color: isOffBudget ? 'var(--accent)' : 'var(--ink-4)',
                                }}
                              >
                                {togglingId === e.id ? (
                                  <Loader2Icon className="size-4 animate-spin" />
                                ) : (
                                  <Receipt className="size-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => openEdit(e)}
                                aria-label="Edit expense"
                                title="Edit expense"
                                style={{ color: 'var(--ink-3)' }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setPendingDelete(e)}
                                aria-label="Delete expense"
                                className="transition-colors hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            </Reveal>
          ))
        )}
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `"${pendingDelete.description}" for ${fmtMoney(pendingDelete.amount, { cents: true })} will be removed. This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit expense dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !editPending) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={editPending}
                autoComplete="off"
              />
            </div>
            <div
              className="edit-expense-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={editPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount</Label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--ink-3)',
                      pointerEvents: 'none',
                    }}
                  >
                    $
                  </span>
                  <Input
                    id="edit-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    disabled={editPending}
                    style={{ paddingLeft: 24 }}
                  />
                </div>
              </div>
            </div>
            <div
              className="edit-expense-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editCategory}
                  onValueChange={(v) => setEditCategory(String(v))}
                  disabled={editPending}
                >
                  <SelectTrigger id="edit-category" className="w-full">
                    <SelectValue placeholder="Pick a category">
                      {(value) => {
                        const c = EXPENSE_CATEGORIES.find(
                          (x) => x.id === value,
                        )
                        return c ? c.id : 'Pick a category'
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-account">Account</Label>
                <Select
                  value={editAccountId}
                  onValueChange={(v) => setEditAccountId(String(v))}
                  disabled={editPending || accounts.length === 0}
                >
                  <SelectTrigger id="edit-account" className="w-full">
                    <SelectValue placeholder="Pick an account">
                      {(value) => {
                        const a = accounts.find((x) => x.id === value)
                        return a ? a.name : 'Pick an account'
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <span
                style={{
                  font: '600 11.5px var(--ui)',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Budget treatment
              </span>
              <div
                role="radiogroup"
                aria-label="Budget treatment"
                style={{
                  display: 'inline-flex',
                  padding: 3,
                  borderRadius: 999,
                  border: '1px solid var(--hair)',
                  background: 'var(--surface-2)',
                  gap: 2,
                }}
              >
                {(
                  [
                    { v: 'co', label: 'In CO budget' },
                    { v: 'reimbursable', label: 'Reimbursable' },
                    { v: 'personal', label: 'Off-budget' },
                  ] as const
                ).map((opt) => {
                  const active = editBudgetKind === opt.v
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setEditBudgetKind(opt.v)}
                      disabled={editPending}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        border: 'none',
                        font: '600 12px var(--ui)',
                        cursor: editPending ? 'not-allowed' : 'pointer',
                        background: active ? 'var(--surface)' : 'transparent',
                        color: active ? 'var(--ink-1)' : 'var(--ink-3)',
                        boxShadow: active
                          ? '0 1px 0 var(--hair), 0 4px 12px -8px rgba(0,0,0,.4)'
                          : 'none',
                        transition: 'all .15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-refund">Partial refund expected</Label>
              <div style={{ position: 'relative', maxWidth: 220 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--ink-3)',
                    pointerEvents: 'none',
                  }}
                >
                  $
                </span>
                <Input
                  id="edit-refund"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={editRefundExpected}
                  onChange={(e) => setEditRefundExpected(e.target.value)}
                  disabled={editPending}
                  style={{ paddingLeft: 24 }}
                  placeholder="0.00"
                />
              </div>
              {editRefundExpected.trim() &&
                parseFloat(editRefundExpected) > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <Checkbox
                      id="edit-refund-settled"
                      checked={editRefundSettled}
                      onCheckedChange={(v) => setEditRefundSettled(v === true)}
                      disabled={editPending}
                    />
                    <label
                      htmlFor="edit-refund-settled"
                      style={{
                        font: '500 12.5px var(--ui)',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                      }}
                    >
                      Refund received
                    </label>
                  </div>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={editPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editPending}>
              {editPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media (max-width: 640px) {
          .edit-expense-grid {
            grid-template-columns: 1fr !important;
          }
          .expense-week-card {
            padding: 4px 12px !important;
          }
          .expense-row {
            gap: 8px !important;
            padding: 12px 2px !important;
          }
          .expense-row-date {
            width: 52px !important;
            font-size: 11px !important;
          }
          .expense-row-amount {
            font-size: 14px !important;
          }
          .budget-summary-meta {
            margin-left: 0 !important;
            font-size: 11.5px !important;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

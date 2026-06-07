'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, endOfWeek, startOfWeek } from 'date-fns'
import { Loader2Icon, Sparkles, Trash2 } from 'lucide-react'
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
import { deleteExpense } from './expense-actions'
import type { AccountOption } from './add-expense-form'
import { ExpenseCharts } from './expense-charts'
import { hueForCategory } from './categories'

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
}

export function ExpenseList({
  expenses,
  accounts,
  cumMaxAllowed,
  cumSpent,
}: Props) {
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const [deleting, startDeleting] = useTransition()

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
                <Card style={{ padding: '4px 16px' }}>
                  <CardContent style={{ padding: 0 }}>
                    {g.expenses.map((e, i) => {
                      const acct = e.account_id
                        ? accountById.get(e.account_id)
                        : undefined
                      const hue = hueForCategory(e.category)
                      return (
                        <div
                          key={e.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '13px 4px',
                            borderTop: i ? '1px solid var(--hair)' : 'none',
                          }}
                        >
                          <span
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
                              {e.count_in_co_budget === false && (
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
                                  Reimbursable
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
                            style={{
                              font: '600 15px var(--display)',
                              color: 'var(--ink-1)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmtMoney(e.amount, { cents: true })}
                          </span>
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
    </div>
  )
}

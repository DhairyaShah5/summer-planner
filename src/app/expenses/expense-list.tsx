'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, endOfWeek, startOfWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { Sparkles, Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import type { Expense } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
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
import { deleteExpense } from './expense-actions'
import type { AccountOption } from './add-expense-form'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Compress a long account name into a chip-friendly short label. */
function shortAccountLabel(name: string, type: AccountOption['type']): string {
  if (type === 'credit_card') {
    // "Chase Credit Card" → "Chase CC"; otherwise append "CC".
    const stripped = name.replace(/credit card/i, '').trim()
    return `${stripped || name} CC`.replace(/\s+/g, ' ')
  }
  if (type === 'hysa') {
    // Keep HYSA names mostly intact, just trim.
    return name
  }
  // checking — drop trailing "Checking"
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
  /** Cumulative CO from every paycheck whose pay_date <= this Sunday. */
  cumMaxAllowed: number
  /** Cumulative expense total through today. */
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

  // Carry-over framing: unspent CO from earlier weeks rolls forward, so the
  // headline measures cumulative cushion across the summer to date.
  const remaining = cumMaxAllowed - cumSpent

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
    <div className="space-y-4">
      <Card
        size="sm"
        className={`border-l-4 transition-shadow hover:shadow-md ${
          remaining >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'
        }`}
      >
        <CardContent className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold tabular-nums ${
                remaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {money.format(Math.abs(remaining))}
            </span>
            <span className="text-sm text-muted-foreground">
              {remaining >= 0
                ? 'left to spend overall'
                : 'over budget overall'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Spent {money.format(cumSpent)} &middot; Maximum allowed{' '}
            {money.format(cumMaxAllowed)}
          </p>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardContent>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center gap-3 py-10 text-center"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                className="rounded-full bg-gradient-to-br from-amber-400/20 to-fuchsia-500/20 p-3"
              >
                <Sparkles className="size-6 text-amber-500" />
              </motion.div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No expenses yet</p>
                <p className="text-xs text-muted-foreground">
                  Add your first one with the form above.
                </p>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      ) : (
        groups.map((g, gi) => (
          <motion.div
            key={g.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06, duration: 0.4 }}
            className="space-y-2"
          >
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-medium text-muted-foreground">
                Week of {format(g.start, 'MMM d')} – {format(g.end, 'MMM d')}
              </h2>
              <span className="text-sm font-semibold tabular-nums">
                {money.format(g.total)}
              </span>
            </div>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="!p-0">
                <ul className="divide-y">
                  {g.expenses.map((e, i) => {
                    const acct = e.account_id
                      ? accountById.get(e.account_id)
                      : undefined
                    return (
                      <motion.li
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: gi * 0.06 + i * 0.02,
                          duration: 0.3,
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {format(parseLocalDate(e.expense_date), 'EEE MMM d')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {e.description}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {e.category && (
                              <Badge variant="outline">{e.category}</Badge>
                            )}
                            {acct && (
                              <Badge
                                variant="secondary"
                                className="font-normal"
                              >
                                {shortAccountLabel(acct.name, acct.type)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {money.format(e.amount)}
                        </span>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(e)}
                          aria-label="Delete expense"
                          className="transition-colors hover:text-destructive"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </motion.li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}

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
                ? `"${pendingDelete.description}" for ${money.format(pendingDelete.amount)} will be removed. This cannot be undone.`
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

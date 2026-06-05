'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, endOfWeek, startOfWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { Sparkles, Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
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
  weeklyTarget: number
}

export function ExpenseList({ expenses, weeklyTarget }: Props) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)

  const groups = useMemo(() => groupByWeek(expenses), [expenses])

  const thisWeekSpent = useMemo(() => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    const startISO = format(start, 'yyyy-MM-dd')
    const endISO = format(end, 'yyyy-MM-dd')
    return expenses
      .filter((e) => e.expense_date >= startISO && e.expense_date <= endISO)
      .reduce((s, e) => s + e.amount, 0)
  }, [expenses])

  const remaining = weeklyTarget - thisWeekSpent

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      router.refresh()
      toast.success('Expense deleted')
      setPendingDelete(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not delete')
    },
  })

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
                ? 'left to spend this week'
                : 'over budget'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Spent {money.format(thisWeekSpent)} &middot; Target{' '}
            {money.format(weeklyTarget)}
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
                  {g.expenses.map((e, i) => (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.06 + i * 0.02, duration: 0.3 }}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {format(parseLocalDate(e.expense_date), 'EEE MMM d')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {e.description}
                        </p>
                        {e.category && (
                          <Badge variant="outline" className="mt-0.5">
                            {e.category}
                          </Badge>
                        )}
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
                  ))}
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
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
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

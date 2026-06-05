'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  PencilIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AnimatedNumber } from '@/components/animated-number'
import { GradientProgress } from '@/components/gradient-progress'
import { cn } from '@/lib/utils'

export type AccountType = 'checking' | 'credit_card' | 'hysa'

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
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

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

function typeBadgeClass(t: AccountType): string {
  switch (t) {
    case 'checking':
      return 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300'
    case 'credit_card':
      return 'bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
    case 'hysa':
      return 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
  }
}

interface Props {
  states: AccountStateRow[]
  vaultCap: number
}

export function AccountsList({ states, vaultCap }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<AccountStateRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const summerCash = useMemo(() => {
    let arrivalCash = 0
    let arrivalDebt = 0
    let projectedCash = 0
    let projectedDebt = 0
    let currentCash = 0
    let currentDebt = 0
    for (const s of states) {
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
    }
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

  const gained = summerCash.delta >= 0

  return (
    <div className="space-y-4">
      {/* Summer Cash hero card */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card
          className={cn(
            'bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/5 to-transparent ring-1 ring-foreground/10 transition-shadow hover:shadow-lg',
          )}
        >
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Came to Colorado with
                </p>
                <div className="text-2xl font-semibold tabular-nums sm:text-3xl">
                  <AnimatedNumber
                    value={summerCash.arrivalNet}
                    format={money.format}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Cash &amp; savings minus credit cards, at arrival
                </p>
              </div>
              <div className="space-y-1 sm:text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Leaving Colorado with (projected)
                </p>
                <div className="text-2xl font-semibold tabular-nums sm:text-3xl">
                  <AnimatedNumber
                    value={summerCash.projectedNet}
                    format={money.format}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  After every paycheck and expense plays out
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-center gap-2">
                <motion.span
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 240,
                    damping: 16,
                    delay: 0.2,
                  }}
                  className={cn(
                    'inline-flex',
                    gained
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {gained ? (
                    <ArrowUpRightIcon className="size-6" />
                  ) : (
                    <ArrowDownRightIcon className="size-6" />
                  )}
                </motion.span>
                <div
                  className={cn(
                    'text-3xl font-semibold tabular-nums sm:text-4xl',
                    gained
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  <span className="mr-1">{gained ? '+' : '−'}</span>
                  <AnimatedNumber
                    value={Math.abs(summerCash.delta)}
                    format={money.format}
                  />
                </div>
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {gained
                  ? 'projected net gain across the summer'
                  : 'projected net loss across the summer'}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Net Worth tile (current) */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="ring-1 ring-foreground/10 transition-shadow hover:shadow-lg">
          <CardContent className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Net Worth (current)
            </p>
            <div
              className={cn(
                'text-3xl font-semibold tabular-nums',
                summerCash.currentNet >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              )}
            >
              <AnimatedNumber
                value={summerCash.currentNet}
                format={money.format}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Live cash &amp; savings minus credit card outstanding
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {states.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              No accounts yet. Seed them via the database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {states.map((s, i) => {
            const isCC = s.type === 'credit_card'
            const isVault = s.is_vault
            const vaultPct =
              isVault && vaultCap > 0
                ? Math.min(100, (s.current / vaultCap) * 100)
                : 0
            const delta = s.projected - s.current
            const deltaGained = delta >= 0
            // For credit cards, "gained" means debt went DOWN — so the
            // arrow + color reflect cash-side intuition (lower CC = good).
            const deltaIsGoodForUser = isCC ? delta <= 0 : delta >= 0
            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {s.name}
                          </span>
                          <Badge
                            className={cn('font-normal', typeBadgeClass(s.type))}
                          >
                            {typeLabel(s.type)}
                          </Badge>
                          {s.is_paycheck_destination && (
                            <Badge variant="outline" className="font-normal">
                              Paycheck
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isCC ? 'Outstanding' : 'Current balance'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${s.name} arrival balance`}
                        onClick={() => {
                          setEditing(s)
                          setEditValue(String(s.arrival))
                        }}
                        className="transition-colors"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                    </div>

                    <div
                      className={cn(
                        'text-3xl font-semibold tabular-nums',
                        isCC && 'text-destructive',
                      )}
                    >
                      <AnimatedNumber value={s.current} format={money.format} />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      <span
                        className={cn(
                          'inline-flex items-center',
                          deltaIsGoodForUser
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {deltaGained ? (
                          <ArrowUpRightIcon className="size-3" />
                        ) : (
                          <ArrowDownRightIcon className="size-3" />
                        )}
                      </span>
                      <span>
                        Projected{' '}
                        <span className="font-medium text-foreground">
                          {money.format(s.projected)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          deltaIsGoodForUser
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        ({deltaGained ? '+' : '−'}
                        {money.format(Math.abs(delta))})
                      </span>
                    </div>

                    {isVault && vaultCap > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                          <span>Goal</span>
                          <span>
                            {money.format(s.current)} of{' '}
                            {moneyWhole.format(vaultCap)}
                          </span>
                        </div>
                        <GradientProgress percent={vaultPct} height="h-2" />
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {vaultPct.toFixed(1)}% funded
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.li>
            )
          })}
        </ul>
      )}

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
    </div>
  )
}

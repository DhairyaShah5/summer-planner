'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ActivityIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  PencilIcon,
  PlaneIcon,
  SparklesIcon,
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
    <div className="space-y-6">
      {/* Three hero stat cards: Past / Present / Future */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* At Arrival */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="h-full bg-muted/40 ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
            <CardContent className="space-y-1.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <PlaneIcon className="size-4" />
                <p className="text-xs uppercase tracking-wide">At Arrival</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Came to Colorado with
              </p>
              <div className="text-2xl font-semibold tabular-nums sm:text-3xl">
                <AnimatedNumber
                  value={summerCash.arrivalNet}
                  format={money.format}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Now */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card className="h-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/30 transition-shadow hover:shadow-lg">
            <CardContent className="space-y-1.5">
              <div className="flex items-center gap-2 text-primary">
                <ActivityIcon className="size-4" />
                <p className="text-xs uppercase tracking-wide">Right Now</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Live net worth today
              </p>
              <div
                className={cn(
                  'text-3xl font-semibold tabular-nums sm:text-4xl',
                  summerCash.currentNet >= 0
                    ? 'text-primary'
                    : 'text-rose-600 dark:text-rose-400',
                )}
              >
                <AnimatedNumber
                  value={summerCash.currentNet}
                  format={money.format}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Leaving With (Projected) */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card
            className={cn(
              'h-full ring-1 transition-shadow hover:shadow-md',
              gained
                ? 'bg-emerald-500/10 ring-emerald-500/30'
                : 'bg-amber-500/10 ring-amber-500/30',
            )}
          >
            <CardContent className="space-y-1.5">
              <div
                className={cn(
                  'flex items-center gap-2',
                  gained
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300',
                )}
              >
                <SparklesIcon className="size-4" />
                <p className="text-xs uppercase tracking-wide">
                  Leaving With (Projected)
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Net worth at summer&apos;s end
              </p>
              <div className="text-2xl font-semibold tabular-nums sm:text-3xl">
                <AnimatedNumber
                  value={summerCash.projectedNet}
                  format={money.format}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delta line */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center justify-center gap-2"
      >
        <span
          className={cn(
            'inline-flex',
            gained
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400',
          )}
        >
          {gained ? (
            <ArrowUpRightIcon className="size-4" />
          ) : (
            <ArrowDownRightIcon className="size-4" />
          )}
        </span>
        <p
          className={cn(
            'text-sm font-medium tabular-nums',
            gained
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-rose-700 dark:text-rose-300',
          )}
        >
          Net change over the summer:{' '}
          <span className="font-semibold">
            {gained ? '+' : '−'}
            {money.format(Math.abs(summerCash.delta))}
          </span>
        </p>
      </motion.div>

      {/* Per Account section */}
      <div className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Per Account</h2>
          <p className="text-xs text-muted-foreground">
            Each account&apos;s journey from arrival through today to the
            projected end of summer.
          </p>
        </div>

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
              const deltaFromNow = s.projected - s.current
              const deltaGained = deltaFromNow >= 0
              // For credit cards, "good" means debt went DOWN — so the
              // arrow + color reflect cash-side intuition (lower CC = good).
              const deltaIsGoodForUser = isCC
                ? deltaFromNow <= 0
                : deltaFromNow >= 0
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="space-y-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {s.name}
                            </span>
                            <Badge
                              className={cn(
                                'font-normal',
                                typeBadgeClass(s.type),
                              )}
                            >
                              {typeLabel(s.type)}
                            </Badge>
                            {s.is_paycheck_destination && (
                              <Badge
                                variant="outline"
                                className="font-normal"
                              >
                                Paycheck
                              </Badge>
                            )}
                            {s.is_vault && (
                              <Badge
                                variant="outline"
                                className="font-normal"
                              >
                                Vault
                              </Badge>
                            )}
                          </div>
                          {isCC && (
                            <p className="text-xs text-muted-foreground">
                              Values shown are outstanding balance
                            </p>
                          )}
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

                      {/* 3-stage horizontal strip */}
                      <div className="grid grid-cols-3 gap-3 border-t pt-3">
                        {/* At Arrival */}
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            At Arrival
                          </p>
                          <div
                            className={cn(
                              'text-base font-medium tabular-nums sm:text-lg',
                              isCC && 'text-destructive',
                            )}
                          >
                            <AnimatedNumber
                              value={s.arrival}
                              format={money.format}
                            />
                          </div>
                        </div>

                        {/* Right Now (focal) */}
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-primary">
                            Right Now
                          </p>
                          <div
                            className={cn(
                              'text-2xl font-semibold tabular-nums sm:text-3xl',
                              isCC ? 'text-destructive' : 'text-primary',
                            )}
                          >
                            <AnimatedNumber
                              value={s.current}
                              format={money.format}
                            />
                          </div>
                        </div>

                        {/* Projected End */}
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Projected End
                          </p>
                          <div
                            className={cn(
                              'text-base font-medium tabular-nums sm:text-lg',
                              isCC && 'text-destructive',
                            )}
                          >
                            <AnimatedNumber
                              value={s.projected}
                              format={money.format}
                            />
                          </div>
                          <div className="flex items-center gap-1 text-[11px] tabular-nums">
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
                              {deltaGained ? '+' : '−'}
                              {money.format(Math.abs(deltaFromNow))}
                            </span>
                            <span className="text-muted-foreground">
                              from now
                            </span>
                          </div>
                        </div>
                      </div>

                      {isVault && vaultCap > 0 && (
                        <div className="space-y-1.5 border-t pt-3">
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
      </div>

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

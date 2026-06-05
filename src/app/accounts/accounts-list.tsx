'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2Icon, PencilIcon } from 'lucide-react'
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

export interface AccountRow {
  id: string
  name: string
  type: AccountType
  current_balance: number
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
  accounts: AccountRow[]
  vaultCap: number
}

export function AccountsList({ accounts, vaultCap }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<AccountRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const netWorth = useMemo(() => {
    let cashSide = 0
    let debt = 0
    for (const a of accounts) {
      if (a.type === 'credit_card') debt += a.current_balance
      else cashSide += a.current_balance
    }
    return cashSide - debt
  }, [accounts])

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
        .update({ current_balance: parsed })
        .eq('id', editing.id)
      if (error) throw error
      toast.success('Balance updated')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
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
          <CardContent className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Net Worth
            </p>
            <div
              className={cn(
                'text-3xl font-semibold tabular-nums',
                netWorth >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              )}
            >
              <AnimatedNumber value={netWorth} format={money.format} />
            </div>
            <p className="text-xs text-muted-foreground">
              Cash &amp; savings minus credit card outstanding
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              No accounts yet. Seed them via the database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {accounts.map((a, i) => {
            const isCC = a.type === 'credit_card'
            const isVault = a.is_vault
            const vaultPct =
              isVault && vaultCap > 0
                ? Math.min(100, (a.current_balance / vaultCap) * 100)
                : 0
            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {a.name}
                          </span>
                          <Badge
                            className={cn('font-normal', typeBadgeClass(a.type))}
                          >
                            {typeLabel(a.type)}
                          </Badge>
                          {a.is_paycheck_destination && (
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
                        aria-label={`Edit ${a.name} balance`}
                        onClick={() => {
                          setEditing(a)
                          setEditValue(String(a.current_balance))
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
                      <AnimatedNumber
                        value={a.current_balance}
                        format={money.format}
                      />
                    </div>

                    {isVault && vaultCap > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                          <span>Goal</span>
                          <span>
                            {money.format(a.current_balance)} of{' '}
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
            <DialogTitle>Edit balance</DialogTitle>
            <DialogDescription>
              {editing
                ? `Manually set the current balance for ${editing.name}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-balance">Current balance</Label>
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

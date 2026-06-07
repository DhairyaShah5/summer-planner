'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCardIcon,
  Loader2Icon,
  PencilIcon,
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
  Reveal,
  SectionLabel,
  Donut,
  CatDot,
  ProgressBar,
  fmtMoney,
} from '@/components/redesign'
import { payCreditCard } from './cc-payment-actions'

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

interface Props {
  states: AccountStateRow[]
  vaultCap: number
}

export function AccountsList({ states, vaultCap }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<AccountStateRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Pay-CC dialog state
  const [paying, setPaying] = useState<AccountStateRow | null>(null)
  const [payFromId, setPayFromId] = useState<string>('')
  const [payAmount, setPayAmount] = useState<string>('')
  const [payDate, setPayDate] = useState<string>(todayISO())
  const [payPending, startPayTransition] = useTransition()

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

  function openPayDialog(cc: AccountStateRow) {
    setPaying(cc)
    setPayFromId(defaultFromAccount?.id ?? '')
    setPayAmount(cc.current > 0 ? cc.current.toFixed(2) : '0.00')
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
      {/* 3 net cards: arrival / now / projected */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        <Reveal>
          <NetCard
            label="At arrival"
            sub="Came to Colorado with"
            value={summary.arrivalNet}
          />
        </Reveal>
        <Reveal delay={50}>
          <NetCard
            label="Right now"
            sub="Live net worth today"
            value={summary.currentNet}
            big
          />
        </Reveal>
        <Reveal delay={100}>
          <NetCard
            label="Leaving with (projected)"
            sub="Net worth at summer's end"
            value={summary.projectedNet}
            accent
          />
        </Reveal>
      </div>

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
                  onEdit={() => {
                    setEditing(s)
                    setEditValue(String(s.arrival))
                  }}
                  onPayCC={() => openPayDialog(s)}
                />
              </Reveal>
            ))}
          </div>
        )}
      </div>

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
              {paying ? `Pay ${paying.name} from...` : 'Pay credit card'}
            </DialogTitle>
            <DialogDescription>
              Record a payment from a checking account to this credit card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pay-from">From account</Label>
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
                  Paying...
                </>
              ) : (
                `Pay ${moneyFmt.format(parseFloat(payAmount) || 0)}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
      className="card fx-card"
      style={{
        padding: 22,
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
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
        style={{
          display: 'flex',
          gap: 28,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Donut data={items} size={170} stroke={26} />
        <div
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
  onEdit: () => void
  onPayCC: () => void
}

function AccountCard({ account, vaultCap, onEdit, onPayCC }: AccountCardProps) {
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
      className="card fx-card"
      style={{
        padding: '18px 24px',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
      }}
    >
      <div
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifySelf: 'end',
          }}
        >
          {isCredit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPayCC}
            >
              <CreditCardIcon className="size-4" />
              Pay credit card
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${account.name} arrival balance`}
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
          </Button>
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

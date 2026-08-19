'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { HandCoins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { fmtMoney } from '@/components/redesign'
import { setPaycheckLenderRouting } from '@/app/accounts/flow-override-actions'
import { syncLenderBalances } from './lender-sync-actions'

export interface LenderOption {
  id: string
  name: string
  outstanding: number
}

export function LenderRoutingButton({
  paycheckId,
  vaultAmount,
  lenders,
  routing,
  compact = false,
}: {
  paycheckId: string
  vaultAmount: number
  lenders: LenderOption[]
  routing: Record<string, number>
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const l of lenders) {
      out[l.id] = routing[l.id] != null ? String(routing[l.id]) : ''
    }
    return out
  })

  const routedTotal = useMemo(() => {
    let s = 0
    for (const v of Object.values(draft)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) s += n
    }
    return s
  }, [draft])

  const marcusLanding = Math.max(0, vaultAmount - routedTotal)
  const overshoot = routedTotal > vaultAmount + 0.005

  function save() {
    if (overshoot) {
      toast.error('Routed amount exceeds this paycheck’s vault')
      return
    }
    const cleaned: Record<string, number> = {}
    for (const [id, raw] of Object.entries(draft)) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) cleaned[id] = n
    }
    startTransition(async () => {
      const result = await setPaycheckLenderRouting(paycheckId, cleaned)
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to save routing')
        return
      }
      // Routing edit shifts the paid-back total, so re-derive each lender's
      // outstanding immediately. Silent failure is fine here — a stale
      // outstanding is a visual issue, not a data-loss issue.
      await syncLenderBalances()
      toast.success(
        Object.keys(cleaned).length === 0
          ? 'Routing cleared'
          : 'Routing saved',
      )
      setOpen(false)
    })
  }

  const activeRoutingSummary = useMemo(() => {
    const parts: string[] = []
    for (const l of lenders) {
      const amt = routing[l.id]
      if (amt != null && amt > 0) parts.push(`${l.name} ${fmtMoney(amt)}`)
    }
    return parts.join(' · ')
  }, [lenders, routing])

  if (lenders.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'icon' : 'sm'}
            className={compact ? 'h-6 w-6' : ''}
            aria-label="Route this vault contribution to a lender"
            title={
              activeRoutingSummary
                ? `Vault routing: ${activeRoutingSummary}`
                : 'Route vault to lender'
            }
          />
        }
      >
        <HandCoins
          size={compact ? 12 : 14}
          strokeWidth={2}
          style={{
            color: activeRoutingSummary
              ? 'var(--accent, oklch(0.7 0.18 285))'
              : 'var(--ink-4)',
          }}
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Route vault to lenders</DialogTitle>
          <DialogDescription>
            This paycheck’s vault is {fmtMoney(vaultAmount)}. Anything you
            route here leaves Chase for a friend instead of Marcus. The row
            still displays {fmtMoney(vaultAmount)} in the Vault column, but
            Marcus and the goal only count the un-routed remainder.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
          {lenders.map((l) => (
            <div
              key={l.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--hair)',
                background: 'var(--surface-2, transparent)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    font: '600 13.5px/1.2 var(--ui)',
                    color: 'var(--ink-1)',
                  }}
                >
                  {l.name}
                </div>
                <div
                  style={{
                    font: '500 12px/1.4 var(--ui)',
                    color: 'var(--ink-3)',
                    marginTop: 2,
                  }}
                >
                  Owe {fmtMoney(l.outstanding)}
                </div>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={draft[l.id] ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, [l.id]: e.target.value })
                }
                placeholder="0"
                style={{ width: 110, textAlign: 'right' }}
                aria-label={`Amount routed to ${l.name}`}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gap: 4,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--surface-2, transparent)',
            border: '1px solid var(--hair)',
          }}
        >
          <Row label="Vault this paycheck" value={fmtMoney(vaultAmount)} />
          <Row
            label="Routed to lenders"
            value={fmtMoney(routedTotal)}
            emphasize={overshoot}
          />
          <Row
            label="Lands in Marcus"
            value={fmtMoney(marcusLanding)}
            strong
          />
          {overshoot && (
            <div
              style={{
                font: '500 12px/1.4 var(--ui)',
                color: 'var(--accent-ink, crimson)',
                marginTop: 4,
              }}
            >
              Routed amount exceeds vault. Trim before saving.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={pending || overshoot}
          >
            Save routing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  label,
  value,
  strong,
  emphasize,
}: {
  label: string
  value: string
  strong?: boolean
  emphasize?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        font: `${strong ? '600' : '500'} ${strong ? '13.5' : '12.5'}px/1.4 var(--ui)`,
        color: emphasize
          ? 'var(--accent-ink, crimson)'
          : strong
            ? 'var(--ink-1)'
            : 'var(--ink-3)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

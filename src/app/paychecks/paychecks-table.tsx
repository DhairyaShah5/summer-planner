'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { computeAll } from '@/lib/calc'
import type { Employer, PaycheckInput, Settings } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type PaycheckRow = {
  id: string
  pay_num: number
  pay_date: string
  employer: string
  hours_worked: number | null
  ot_hours: number
  actual_net_wages: number | null
  per_diem: number
  extra_deposit: number
  vault_override: number | null
  rent_paid: number
  notes: string | null
}

type EditableField =
  | 'hours_worked'
  | 'ot_hours'
  | 'per_diem'
  | 'actual_net_wages'
  | 'extra_deposit'
  | 'notes'

type UpdatePayload = {
  id: string
  patch: Partial<Pick<
    PaycheckRow,
    | 'hours_worked'
    | 'ot_hours'
    | 'per_diem'
    | 'actual_net_wages'
    | 'extra_deposit'
    | 'vault_override'
    | 'rent_paid'
    | 'notes'
  >>
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function toEmployer(s: string): Employer {
  return s === 'Colorado Internship' ? 'Colorado Internship' : 'USC On-Campus'
}

function toInput(r: PaycheckRow): PaycheckInput {
  return {
    payNum: r.pay_num,
    payDate: r.pay_date,
    employer: toEmployer(r.employer),
    hoursWorked: r.hours_worked,
    otHours: r.ot_hours,
    actualNetWages: r.actual_net_wages,
    perDiem: r.per_diem,
    extraDeposit: r.extra_deposit,
    vaultOverride: r.vault_override,
    rentPaid: r.rent_paid,
  }
}

export function PaychecksTable({
  initialRows,
  settings,
}: {
  initialRows: PaycheckRow[]
  settings: Settings
}) {
  const [rows, setRows] = useState<PaycheckRow[]>(initialRows)
  const queryClient = useQueryClient()

  const computed = useMemo(
    () => computeAll(rows.map(toInput), settings),
    [rows, settings],
  )

  const totals = useMemo(() => {
    let totalVault = 0
    let totalCO = 0
    let totalBuffer = 0
    for (const r of computed) {
      totalVault += r.vault
      totalCO += r.co
      totalBuffer += r.buffer
    }
    const cumulative = computed.length
      ? computed[computed.length - 1].cumulativeVault
      : 0
    return { totalVault, totalCO, totalBuffer, cumulative }
  }, [computed])

  const mutation = useMutation({
    mutationFn: async ({ id, patch }: UpdatePayload) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('paychecks')
        .update(patch)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paychecks'] })
      toast.success('Saved')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast.error(msg)
    },
  })

  function commit(id: string, field: EditableField, raw: string) {
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r }
        switch (field) {
          case 'actual_net_wages': {
            updated.actual_net_wages = raw.trim() === '' ? null : Number(raw)
            break
          }
          case 'hours_worked': {
            updated.hours_worked = raw.trim() === '' ? null : Number(raw)
            break
          }
          case 'ot_hours': {
            updated.ot_hours = raw.trim() === '' ? 0 : Number(raw)
            break
          }
          case 'per_diem': {
            updated.per_diem = raw.trim() === '' ? 0 : Number(raw)
            break
          }
          case 'extra_deposit': {
            updated.extra_deposit = raw.trim() === '' ? 0 : Number(raw)
            break
          }
          case 'notes': {
            updated.notes = raw === '' ? null : raw
            break
          }
        }

        const patch: UpdatePayload['patch'] = {}
        if (field === 'actual_net_wages') patch.actual_net_wages = updated.actual_net_wages
        if (field === 'hours_worked') patch.hours_worked = updated.hours_worked
        if (field === 'ot_hours') patch.ot_hours = updated.ot_hours
        if (field === 'per_diem') patch.per_diem = updated.per_diem
        if (field === 'extra_deposit') patch.extra_deposit = updated.extra_deposit
        if (field === 'notes') patch.notes = updated.notes

        mutation.mutate({ id, patch })
        return updated
      })
      return next
    })
  }

  const vaultProgressPct = settings.vaultCap
    ? Math.min(100, (totals.cumulative / settings.vaultCap) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Pay Date</TableHead>
              <TableHead>Employer</TableHead>
              <TableHead className="bg-amber-50/60">Hours</TableHead>
              <TableHead className="bg-amber-50/60">OT</TableHead>
              <TableHead className="bg-amber-50/60">Per Diem</TableHead>
              <TableHead className="bg-amber-50/60">Actual Net</TableHead>
              <TableHead className="bg-amber-50/60">Extra Deposit</TableHead>
              <TableHead className="bg-muted/50 text-right">Gross</TableHead>
              <TableHead className="bg-muted/50 text-right">Net %</TableHead>
              <TableHead className="bg-muted/50 text-right">Vault</TableHead>
              <TableHead className="bg-muted/50 text-right">CO</TableHead>
              <TableHead className="bg-muted/50 text-right">Buffer</TableHead>
              <TableHead className="bg-muted/50 text-right">Cum. Vault</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="bg-amber-50/60">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const c = computed[i]
              const isUSC = c.employer === 'USC On-Campus'
              const projectedNetPlaceholder = money
                .format(c.estimatedNet)
                .replace('$', '')
              return (
                <TableRow key={row.id}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {row.pay_num}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(parseISO(row.pay_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        'font-normal',
                        isUSC
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                          : 'bg-green-100 text-green-800 hover:bg-green-100',
                      )}
                    >
                      {isUSC ? 'USC' : 'NTT'}
                    </Badge>
                  </TableCell>
                  <NumberCell
                    value={row.hours_worked}
                    step="1"
                    onCommit={(v) => commit(row.id, 'hours_worked', v)}
                  />
                  <NumberCell
                    value={row.ot_hours}
                    step="1"
                    onCommit={(v) => commit(row.id, 'ot_hours', v)}
                  />
                  <NumberCell
                    value={row.per_diem}
                    step="0.01"
                    onCommit={(v) => commit(row.id, 'per_diem', v)}
                  />
                  <NumberCell
                    value={row.actual_net_wages}
                    step="0.01"
                    placeholder={projectedNetPlaceholder}
                    onCommit={(v) => commit(row.id, 'actual_net_wages', v)}
                  />
                  <NumberCell
                    value={row.extra_deposit}
                    step="0.01"
                    onCommit={(v) => commit(row.id, 'extra_deposit', v)}
                  />
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {money.format(c.gross)}
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {pct.format(c.netPct)}
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {money.format(c.vault)}
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {money.format(c.co)}
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {money.format(c.buffer)}
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums font-medium">
                    {money.format(c.cumulativeVault)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={c.status === 'Received' ? 'default' : 'outline'}
                      className={cn(
                        'font-normal',
                        c.status === 'Received' &&
                          'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
                      )}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="bg-amber-50/60">
                    <Input
                      type="text"
                      defaultValue={row.notes ?? ''}
                      className="h-7 w-40 text-xs"
                      onBlur={(e) => {
                        const v = e.currentTarget.value
                        if ((row.notes ?? '') !== v) {
                          commit(row.id, 'notes', v)
                        }
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat label="Total Vault" value={money.format(totals.totalVault)} />
        <SummaryStat label="Total CO" value={money.format(totals.totalCO)} />
        <SummaryStat label="Total Buffer" value={money.format(totals.totalBuffer)} />
        <SummaryStat
          label="Vault Progress"
          value={`${money.format(totals.cumulative)} of ${money.format(settings.vaultCap)}`}
          progress={vaultProgressPct}
        />
      </div>
    </div>
  )
}

function NumberCell({
  value,
  step,
  placeholder,
  onCommit,
}: {
  value: number | null
  step: string
  placeholder?: string
  onCommit: (v: string) => void
}) {
  const initial = value == null ? '' : String(value)
  return (
    <TableCell className="bg-amber-50/60">
      <Input
        key={initial}
        type="number"
        step={step}
        defaultValue={initial}
        placeholder={placeholder}
        className="h-7 w-24 text-xs tabular-nums"
        onBlur={(e) => {
          const raw = e.currentTarget.value
          if (raw !== initial) onCommit(raw)
        }}
      />
    </TableCell>
  )
}

function SummaryStat({
  label,
  value,
  progress,
}: {
  label: string
  value: string
  progress?: number
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {progress != null && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

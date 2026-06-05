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
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  received: boolean
}

type EditableField =
  | 'hours_worked'
  | 'ot_hours'
  | 'per_diem'
  | 'actual_net_wages'
  | 'extra_deposit'
  | 'vault_override'
  | 'rent_paid'
  | 'notes'
  | 'received'

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
    | 'received'
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
    received: r.received,
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
    let currentVault = 0
    let currentCO = 0
    let currentBuffer = 0
    for (const r of computed) {
      totalVault += r.vault
      totalCO += r.co
      totalBuffer += r.buffer
      if (r.received) {
        currentVault += r.vault + r.extraDeposit
        currentCO += r.co
        currentBuffer += r.buffer
      }
    }
    if (settings.vaultCap > 0) {
      currentVault = Math.min(currentVault, settings.vaultCap)
    }
    const cumulative = computed.length
      ? computed[computed.length - 1].cumulativeVault
      : 0
    return {
      totalVault,
      totalCO,
      totalBuffer,
      cumulative,
      currentVault,
      currentCO,
      currentBuffer,
    }
  }, [computed, settings.vaultCap])

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

  function commit(id: string, field: EditableField, raw: string | boolean) {
    // Build the patch first (pure), then update state and fire mutation
    // outside the setState updater so React StrictMode double-invocations
    // don't fire the mutation twice.
    const patch: UpdatePayload['patch'] = {}
    if (field === 'received') {
      patch.received = Boolean(raw)
    } else {
      const trimmed = String(raw).trim()
      switch (field) {
        case 'actual_net_wages': {
          patch.actual_net_wages = trimmed === '' ? null : Number(trimmed)
          break
        }
        case 'vault_override': {
          patch.vault_override = trimmed === '' ? null : Number(trimmed)
          break
        }
        case 'hours_worked': {
          patch.hours_worked = trimmed === '' ? null : Number(trimmed)
          break
        }
        case 'ot_hours': {
          patch.ot_hours = trimmed === '' ? 0 : Number(trimmed)
          break
        }
        case 'per_diem': {
          patch.per_diem = trimmed === '' ? 0 : Number(trimmed)
          break
        }
        case 'extra_deposit': {
          patch.extra_deposit = trimmed === '' ? 0 : Number(trimmed)
          break
        }
        case 'rent_paid': {
          patch.rent_paid = trimmed === '' ? 0 : Number(trimmed)
          break
        }
        case 'notes': {
          // Notes preserves whitespace; use raw for blank check.
          patch.notes = raw === '' ? null : String(raw)
          break
        }
      }
    }

    // Optimistic local update so computed cells (vault/CO/buffer/cumulative)
    // reflect the new value immediately without waiting for refetch.
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )

    mutation.mutate({ id, patch })
  }

  const vaultProgressPct = settings.vaultCap
    ? Math.min(100, (totals.currentVault / settings.vaultCap) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead className="w-[110px]">Pay Date</TableHead>
              <TableHead className="w-[70px]">Employer</TableHead>
              <TableHead className="w-[70px] text-center">Received</TableHead>
              <TableHead className="bg-amber-100/40 w-[90px]">Hours</TableHead>
              <TableHead className="bg-amber-100/40 w-[80px]">OT</TableHead>
              <TableHead className="bg-amber-100/40 w-[90px]">Per Diem</TableHead>
              <TableHead className="bg-amber-100/40 w-[110px]">Actual Net</TableHead>
              <TableHead className="bg-amber-100/40 w-[110px]">
                Vault Override
              </TableHead>
              <TableHead className="bg-amber-100/40 w-[240px]">Notes</TableHead>
              <TableHead className="bg-muted/50 text-right w-[100px]">
                Vault $
              </TableHead>
              <TableHead className="bg-muted/50 text-right w-[100px]">
                CO $
              </TableHead>
              <TableHead className="w-[90px] text-center">Status</TableHead>
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
                <TableRow
                  key={row.id}
                  className="odd:bg-muted/30 transition-colors hover:bg-muted/60 [&>td]:py-3 h-[72px]"
                >
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2" />
                        }
                      >
                        {row.pay_num}
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1 text-left tabular-nums">
                          <div className="flex justify-between gap-3">
                            <span className="text-background/70">Gross</span>
                            <span>{money.format(c.gross)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-background/70">Net %</span>
                            <span>{pct.format(c.netPct)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-background/70">
                              Rent Paid
                            </span>
                            <span>{money.format(row.rent_paid)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-background/70">
                              Extra Deposit
                            </span>
                            <span>{money.format(row.extra_deposit)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-background/70">Buffer</span>
                            <span>{money.format(c.buffer)}</span>
                          </div>
                          <div className="flex justify-between gap-3 border-t border-background/20 pt-1 mt-1">
                            <span className="text-background/70">
                              Cum. Vault
                            </span>
                            <span>{money.format(c.cumulativeVault)}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {format(parseISO(row.pay_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        'font-normal',
                        isUSC
                          ? 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300'
                          : 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
                      )}
                    >
                      {isUSC ? 'USC' : 'NTT'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center bg-amber-100/40">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={row.received}
                        onCheckedChange={(checked) =>
                          commit(row.id, 'received', Boolean(checked))
                        }
                        aria-label="Mark paycheck received"
                      />
                    </div>
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
                    value={row.vault_override}
                    step="0.01"
                    placeholder="auto"
                    onCommit={(v) => commit(row.id, 'vault_override', v)}
                  />
                  <TableCell className="bg-amber-100/40">
                    <Textarea
                      key={row.notes ?? ''}
                      defaultValue={row.notes ?? ''}
                      rows={2}
                      className="min-h-[48px] w-[220px] text-xs leading-tight px-2 py-1.5 focus:bg-amber-200/60 transition-colors"
                      onBlur={(e) => {
                        const v = e.currentTarget.value
                        if ((row.notes ?? '') !== v) {
                          commit(row.id, 'notes', v)
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {money.format(c.vault)}
                  </TableCell>
                  <TableCell className="bg-muted/40 text-right tabular-nums text-muted-foreground">
                    {money.format(c.co)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={c.status === 'Received' ? 'default' : 'outline'}
                      className={cn(
                        'font-normal',
                        c.status === 'Pending' &&
                          'bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 border-transparent',
                      )}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat
          label="Total Vault"
          tag="Current"
          value={money.format(totals.currentVault)}
          projected={`Projected ${money.format(totals.cumulative)}`}
        />
        <SummaryStat
          label="Summer CO Budget"
          tag="Projected"
          value={money.format(totals.totalCO)}
          projected={`Current allocated ${money.format(totals.currentCO)} of projected ${money.format(totals.totalCO)}`}
        />
        <SummaryStat
          label="Total Buffer"
          tag="Current"
          value={money.format(totals.currentBuffer)}
          projected={`Projected ${money.format(totals.totalBuffer)}`}
        />
        <SummaryStat
          label="Vault Progress"
          tag="Current"
          value={`${vaultProgressPct.toFixed(1)}%`}
          projected={`${money.format(totals.currentVault)} of ${money.format(settings.vaultCap)}`}
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
    <TableCell className="bg-amber-100/40">
      <Input
        key={initial}
        type="number"
        step={step}
        defaultValue={initial}
        placeholder={placeholder}
        className="h-8 w-20 text-xs tabular-nums focus:bg-amber-200/60 transition-colors"
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
  tag,
  projected,
  progress,
}: {
  label: string
  value: string
  tag?: string
  projected?: string
  progress?: number
}) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {tag && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        )}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {projected && (
        <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {projected}
        </div>
      )}
      {progress != null && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { NotebookPen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { computeAll } from '@/lib/calc'
import type { Employer, PaycheckInput, Settings } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { GradientProgress } from '@/components/gradient-progress'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
        <Table className="min-w-[1380px] table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-1.5 text-center">#</TableHead>
              <TableHead className="w-[70px] px-1.5">Pay Date</TableHead>
              <TableHead className="w-[56px] px-1.5">Employer</TableHead>
              <TableHead className="w-[64px] px-1.5 text-center">Received</TableHead>
              <TableHead className="w-[72px] px-1.5 text-right">Hours</TableHead>
              <TableHead className="w-[64px] px-1.5 text-right">OT</TableHead>
              <TableHead className="w-[84px] px-1.5 text-right">Per Diem</TableHead>
              <TableHead className="w-[100px] px-1.5 text-right">Actual Net</TableHead>
              <TableHead className="w-[100px] px-1.5 text-right">Expected Pay</TableHead>
              <TableHead className="w-[100px] px-1.5 text-right">Extra Deposit</TableHead>
              <TableHead className="w-[68px] px-1.5 text-right">Net %</TableHead>
              <TableHead className="w-[112px] px-1.5 text-right">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help underline decoration-dotted decoration-from-font decoration-muted-foreground/50 underline-offset-4" />
                    }
                  >
                    Vault
                  </TooltipTrigger>
                  <TooltipContent>To Tuition Vault</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-[112px] px-1.5 text-right">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help underline decoration-dotted decoration-from-font decoration-muted-foreground/50 underline-offset-4" />
                    }
                  >
                    Rent
                  </TooltipTrigger>
                  <TooltipContent>To CA Rent / Bills</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-[108px] px-1.5 text-right">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help underline decoration-dotted decoration-from-font decoration-muted-foreground/50 underline-offset-4" />
                    }
                  >
                    RH
                  </TooltipTrigger>
                  <TooltipContent>To Robinhood</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-[112px] px-1.5 text-right">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help underline decoration-dotted decoration-from-font decoration-muted-foreground/50 underline-offset-4" />
                    }
                  >
                    CO Spend
                  </TooltipTrigger>
                  <TooltipContent>To Colorado Spending</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-8 px-1.5 text-center">
                <span className="sr-only">Notes</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const c = computed[i]
              const isUSC = c.employer === 'USC On-Campus'
              const projectedNetPlaceholder = money
                .format(c.estimatedNet)
                .replace('$', '')
              const hasNotes = (row.notes ?? '').trim().length > 0
              return (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.3 }}
                  data-slot="table-row"
                  className="border-b odd:bg-muted/20 transition-colors hover:bg-muted/40 [&>td]:py-1 [&>td]:px-1.5 h-12"
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
                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                    {format(parseISO(row.pay_date), 'MMM d')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        'font-normal px-1.5 py-0 text-[10px]',
                        isUSC
                          ? 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300'
                          : 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
                      )}
                    >
                      {isUSC ? 'USC' : 'NTT'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
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
                    width="w-16"
                    onCommit={(v) => commit(row.id, 'hours_worked', v)}
                  />
                  <NumberCell
                    value={row.ot_hours}
                    step="1"
                    width="w-14"
                    onCommit={(v) => commit(row.id, 'ot_hours', v)}
                  />
                  <NumberCell
                    value={row.per_diem}
                    step="0.01"
                    width="w-20"
                    onCommit={(v) => commit(row.id, 'per_diem', v)}
                  />
                  <NumberCell
                    value={row.actual_net_wages}
                    step="0.01"
                    width="w-24"
                    placeholder={projectedNetPlaceholder}
                    onCommit={(v) => commit(row.id, 'actual_net_wages', v)}
                  />
                  <TableCell className="text-right tabular-nums text-xs font-medium text-muted-foreground">
                    {money.format(c.estimatedNet)}
                  </TableCell>
                  <NumberCell
                    value={row.extra_deposit}
                    step="0.01"
                    width="w-24"
                    onCommit={(v) => commit(row.id, 'extra_deposit', v)}
                  />
                  <TableCell className="text-right tabular-nums text-xs font-medium text-muted-foreground">
                    {pct.format(c.netPct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium text-muted-foreground">
                    {money.format(c.vault)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium text-muted-foreground">
                    {money.format(row.rent_paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium text-muted-foreground">
                    {money.format(c.robinhood)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium text-muted-foreground">
                    {money.format(c.co)}
                  </TableCell>
                  <TableCell className="text-center">
                    <NotesPopover
                      notes={row.notes}
                      hasNotes={hasNotes}
                      onCommit={(v) => commit(row.id, 'notes', v)}
                    />
                  </TableCell>
                </motion.tr>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat
          index={0}
          label="Total Vault"
          tag="Current"
          value={money.format(totals.currentVault)}
          projected={`Projected ${money.format(totals.cumulative)}`}
        />
        <SummaryStat
          index={1}
          label="Summer CO Budget"
          tag="Projected"
          value={money.format(totals.totalCO)}
          projected={`Current allocated ${money.format(totals.currentCO)} of projected ${money.format(totals.totalCO)}`}
        />
        <SummaryStat
          index={2}
          label="Total Buffer"
          tag="Current"
          value={money.format(totals.currentBuffer)}
          projected={`Projected ${money.format(totals.totalBuffer)}`}
        />
        <SummaryStat
          index={3}
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
  width = 'w-20',
  placeholder,
  onCommit,
}: {
  value: number | null
  step: string
  width?: string
  placeholder?: string
  onCommit: (v: string) => void
}) {
  const initial = value == null ? '' : String(value)
  return (
    <TableCell className="text-right">
      <Input
        key={initial}
        type="number"
        step={step}
        defaultValue={initial}
        placeholder={placeholder}
        className={cn(
          'h-8 text-xs text-right tabular-nums bg-muted/30 focus:ring-1 focus:ring-primary ml-auto',
          width,
        )}
        onBlur={(e) => {
          const raw = e.currentTarget.value
          if (raw !== initial) onCommit(raw)
        }}
      />
    </TableCell>
  )
}

function NotesPopover({
  notes,
  hasNotes,
  onCommit,
}: {
  notes: string | null
  hasNotes: boolean
  onCommit: (v: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={hasNotes ? 'Edit notes' : 'Add notes'}
          />
        }
      >
        <NotebookPen
          className={cn(
            'size-4',
            hasNotes ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <Textarea
          key={notes ?? ''}
          defaultValue={notes ?? ''}
          rows={4}
          placeholder="Notes…"
          className="min-h-[96px] w-full text-xs leading-snug focus:ring-1 focus:ring-primary"
          onBlur={(e) => {
            const v = e.currentTarget.value
            if ((notes ?? '') !== v) {
              onCommit(v)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function SummaryStat({
  label,
  value,
  tag,
  projected,
  progress,
  index = 0,
}: {
  label: string
  value: string
  tag?: string
  projected?: string
  progress?: number
  index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-lg"
    >
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
        <div className="mt-2">
          <GradientProgress percent={progress} height="h-2" />
        </div>
      )}
    </motion.div>
  )
}

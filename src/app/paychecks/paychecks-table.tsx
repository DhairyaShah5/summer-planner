'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, NotebookPen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { computeAll } from '@/lib/calc'
import type { Employer, PaycheckInput, Settings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  CatDot,
  Donut,
  GaugeArc,
  ProgressBar,
  Reveal,
  SectionLabel,
  fmtDate,
  fmtMoney,
} from '@/components/redesign'
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
  reimbursement: number
  extra_deposit: number
  vault_override: number | null
  gross_override: number | null
  rent_paid: number
  notes: string | null
  received: boolean
}

type EditableField =
  | 'hours_worked'
  | 'ot_hours'
  | 'per_diem'
  | 'reimbursement'
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
    | 'reimbursement'
    | 'actual_net_wages'
    | 'extra_deposit'
    | 'vault_override'
    | 'rent_paid'
    | 'notes'
    | 'received'
  >>
}

const pct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const USC_HUE = 235
const NTT_HUE = 150
const HUE = {
  vault: 285,
  rent: 35,
  rh: 150,
  co: 220,
  bofa: 330,
} as const

// Per-bucket bar colors matched to the same HUE values used in the
// Paychecks table's money cells (`oklch(0.55 0.14 hue)`) but bumped in
// lightness + chroma so they read clearly on dark fills. Same hue family
// → visual consistency between the table column and the chart segment.
const BUCKET_COLOR = {
  vault: 'oklch(0.7 0.18 285)', // violet (matches Vault column text)
  rent: 'oklch(0.7 0.18 35)', // warm red-orange (matches Rent column)
  rh: 'oklch(0.7 0.18 150)', // emerald (matches RH column)
  co: 'oklch(0.7 0.18 220)', // sky blue (matches CO Spend column)
  bofa: 'oklch(0.7 0.18 330)', // pink-magenta (matches BofA column)
} as const

function colorForHue(hue: number): string {
  switch (hue) {
    case HUE.vault: return BUCKET_COLOR.vault
    case HUE.rent: return BUCKET_COLOR.rent
    case HUE.rh: return BUCKET_COLOR.rh
    case HUE.co: return BUCKET_COLOR.co
    case HUE.bofa: return BUCKET_COLOR.bofa
    default: return `oklch(0.7 0.2 ${hue})`
  }
}

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
    reimbursement: r.reimbursement,
    extraDeposit: r.extra_deposit,
    vaultOverride: r.vault_override,
    grossOverride: r.gross_override,
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
        case 'reimbursement': {
          patch.reimbursement = trimmed === '' ? 0 : Number(trimmed)
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
          patch.notes = raw === '' ? null : String(raw)
          break
        }
      }
    }

    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )

    mutation.mutate({ id, patch })
  }

  const nextPendingIndex = computed.findIndex((c) => !c.received)
  const allocBars: AllocBar[] = computed.map((c, i) => ({
    label: fmtDate(typeof c.payDate === 'string' ? c.payDate : c.payDate.toISOString().slice(0, 10), 'short'),
    employer: c.employer === 'USC On-Campus' ? 'USC' : 'NTT',
    received: c.received,
    isNext: i === nextPendingIndex,
    segments: [
      { key: 'Vault', value: c.vault + c.extraDeposit, hue: HUE.vault },
      { key: 'Rent', value: c.rentPaid, hue: HUE.rent },
      { key: 'RH', value: c.robinhood, hue: HUE.rh },
      { key: 'CO', value: c.co, hue: HUE.co },
      { key: 'BofA', value: c.bofaOverflow, hue: HUE.bofa },
    ],
  }))
  const allocMax = Math.max(
    1,
    ...allocBars.map((b) => b.segments.reduce((s, x) => s + x.value, 0)),
  )

  // Cumulative buffer per paycheck for the Buffer card sparkline. Walks
  // through every paycheck, adding c.buffer so the series shows the full
  // expected accumulation. The card's split-line render uses receivedCount
  // to draw the past as solid and the future as dashed.
  const bufferSeries: number[] = (() => {
    let running = 0
    const out: number[] = [0]
    for (const c of computed) {
      running += c.buffer
      out.push(running)
    }
    return out
  })()
  const receivedCount = computed.filter((c) => c.received).length

  const uscNet = computed
    .filter((c) => c.employer === 'USC On-Campus')
    .reduce((s, c) => s + (c.actualNetWages ?? c.estimatedNet), 0)
  const nttNet = computed
    .filter((c) => c.employer === 'Colorado Internship')
    .reduce((s, c) => s + (c.actualNetWages ?? c.estimatedNet), 0)
  const employerTotals = [
    { label: 'USC', hue: USC_HUE, total: uscNet },
    { label: 'NTT', hue: NTT_HUE, total: nttNet },
  ]
  const totalIncome = uscNet + nttNet
  const collected = computed
    .filter((c) => c.received)
    .reduce((s, c) => s + (c.actualNetWages ?? c.estimatedNet), 0)
  const collectedPct = totalIncome > 0 ? collected / totalIncome : 0

  const legend: Array<[string, number]> = [
    ['Vault', HUE.vault],
    ['Rent', HUE.rent],
    ['RH', HUE.rh],
    ['CO', HUE.co],
    ['BofA', HUE.bofa],
  ]

  return (
    <div className="space-y-4">
      <Reveal>
        <div
          data-no-tilt
          className="paychecks-table-card"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius)',
            padding: 0,
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              maxWidth: '100%',
            }}
          >
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                minWidth: 1400,
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <thead>
                <tr>
                  <Th align="center">#</Th>
                  <Th align="center">Pay Date</Th>
                  <Th align="center">Employer</Th>
                  <Th align="center">Received</Th>
                  <Th align="center">Hours</Th>
                  <Th align="center">OT</Th>
                  <Th align="center">Per Diem</Th>
                  <Th align="center">Reimburse</Th>
                  <Th align="center">Actual Net</Th>
                  <Th align="center">Gross Pay</Th>
                  <Th align="center">Extra Dep.</Th>
                  <Th align="center">Net %</Th>
                  <Th align="center">Vault</Th>
                  <Th align="center">Rent</Th>
                  <Th align="center">RH</Th>
                  <Th align="center">CO Spend</Th>
                  <Th align="center">BofA</Th>
                  <Th align="center">
                    <span className="sr-only">Notes</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const c = computed[i]
                  const isUSC = c.employer === 'USC On-Campus'
                  const empHue = isUSC ? USC_HUE : NTT_HUE
                  const empLabel = isUSC ? 'USC' : 'NTT'
                  const projectedNetPlaceholder = c.estimatedNet
                    .toFixed(2)
                  const hasNotes = (row.notes ?? '').trim().length > 0
                  const isLast = i === rows.length - 1
                  const rowBg = row.received
                    ? 'color-mix(in oklch, var(--mint) 6%, transparent)'
                    : 'transparent'
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: rowBg,
                        transition: 'background .15s',
                      }}
                    >
                      <Td align="center" last={isLast}>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span
                                style={{
                                  font: '600 12px var(--display)',
                                  color: 'var(--ink-4)',
                                  cursor: 'help',
                                  textDecoration: 'underline dotted',
                                  textUnderlineOffset: 2,
                                }}
                              />
                            }
                          >
                            {row.pay_num}
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 text-left tabular-nums">
                              <KV label="Gross" v={fmtMoney(c.gross, { cents: true })} />
                              <KV label="Net %" v={pct.format(c.netPct)} />
                              <KV
                                label="Rent Paid"
                                v={fmtMoney(row.rent_paid, { cents: true })}
                              />
                              <KV
                                label="Buffer"
                                v={fmtMoney(c.buffer, { cents: true })}
                              />
                              <div className="border-t border-background/20 pt-1 mt-1">
                                <KV
                                  label="Cum. Vault"
                                  v={fmtMoney(c.cumulativeVault, { cents: true })}
                                />
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </Td>
                      <Td align="center" last={isLast}>
                        <span
                          style={{
                            font: '600 13px var(--ui)',
                            color: 'var(--ink-1)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtDate(row.pay_date, 'short')}
                        </span>
                      </Td>
                      <Td align="center" last={isLast}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            font: '600 11px var(--ui)',
                            padding: '3px 9px',
                            borderRadius: 7,
                            background: `color-mix(in oklch, oklch(0.62 0.16 ${empHue}) 16%, transparent)`,
                            color: `oklch(0.55 0.16 ${empHue})`,
                          }}
                        >
                          {empLabel}
                        </span>
                      </Td>
                      <Td align="center" last={isLast}>
                        <ReceivedCheck
                          checked={row.received}
                          onChange={(v) => commit(row.id, 'received', v)}
                        />
                      </Td>
                      <NumberCell
                        last={isLast}
                        value={row.hours_worked}
                        step="1"
                        align="center"
                        onCommit={(v) => commit(row.id, 'hours_worked', v)}
                      />
                      <NumberCell
                        last={isLast}
                        value={row.ot_hours}
                        step="1"
                        align="center"
                        onCommit={(v) => commit(row.id, 'ot_hours', v)}
                      />
                      <NumberCell
                        last={isLast}
                        value={row.per_diem}
                        step="0.01"
                        align="center"
                        onCommit={(v) => commit(row.id, 'per_diem', v)}
                      />
                      <NumberCell
                        last={isLast}
                        value={row.reimbursement}
                        step="0.01"
                        align="center"
                        onCommit={(v) => commit(row.id, 'reimbursement', v)}
                      />
                      <NumberCell
                        last={isLast}
                        value={row.actual_net_wages}
                        step="0.01"
                        align="center"
                        strong
                        placeholder={projectedNetPlaceholder}
                        onCommit={(v) => commit(row.id, 'actual_net_wages', v)}
                      />
                      <Td align="center" last={isLast}>
                        <MoneyCell value={c.gross} muted />
                      </Td>
                      <NumberCell
                        last={isLast}
                        value={row.extra_deposit}
                        step="0.01"
                        align="center"
                        onCommit={(v) => commit(row.id, 'extra_deposit', v)}
                      />
                      <Td align="center" last={isLast}>
                        <span
                          style={{
                            font: '500 12.5px var(--ui)',
                            color: 'var(--ink-3)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {pct.format(c.netPct)}
                        </span>
                      </Td>
                      <Td align="center" last={isLast}>
                        <MoneyCell value={c.vault} hue={HUE.vault} />
                      </Td>
                      <Td align="center" last={isLast}>
                        <MoneyCell value={row.rent_paid} hue={HUE.rent} />
                      </Td>
                      <Td align="center" last={isLast}>
                        <MoneyCell value={c.robinhood} hue={HUE.rh} />
                      </Td>
                      <Td align="center" last={isLast}>
                        <MoneyCell value={c.co} hue={HUE.co} />
                      </Td>
                      <Td align="center" last={isLast}>
                        <MoneyCell value={c.bofaOverflow} hue={HUE.bofa} />
                      </Td>
                      <Td align="center" last={isLast}>
                        <NotesPopover
                          notes={row.notes}
                          hasNotes={hasNotes}
                          onCommit={(v) => commit(row.id, 'notes', v)}
                        />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div
          className="card fx-card paychecks-alloc-card"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius)',
            padding: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 18,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  font: '600 12px/1 var(--ui)',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  marginBottom: 6,
                }}
              >
                Allocation per paycheck
              </div>
              <div
                style={{
                  font: '500 12px var(--ui)',
                  color: 'var(--ink-3)',
                }}
              >
                Hover a bar for the breakdown. Next pending paycheck is
                accent-outlined.
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
                {legend.map(([l, h]) => (
                  <span
                    key={l}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      font: '500 11.5px var(--ui)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: colorForHue(h),
                        flex: 'none',
                      }}
                    />
                    {l}
                  </span>
                ))}
            </div>
          </div>
          <div
            className="paychecks-alloc-scroll"
            style={{
              WebkitOverflowScrolling: 'touch',
              maxWidth: '100%',
            }}
          >
            <div className="paychecks-alloc-inner">
              <AllocationChart bars={allocBars} max={allocMax} height={260} />
            </div>
          </div>
        </div>
      </Reveal>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <Reveal from="left" delay={140}>
          <div
            className="card fx-card paychecks-summary-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--radius)',
              padding: 22,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SectionLabel
              right={
                <span
                  style={{
                    font: '500 12px var(--ui)',
                    color: 'var(--ink-3)',
                  }}
                >
                  {fmtMoney(totalIncome)} total
                </span>
              }
            >
              Net income by employer
            </SectionLabel>
            <div
              style={{
                display: 'flex',
                gap: 28,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                flex: 1,
              }}
            >
              <Donut
                data={employerTotals}
                size={150}
                stroke={24}
                tooltipContent={(d, pct) => (
                  <div style={{ minWidth: 110, textAlign: 'center' }}>
                    <div
                      style={{
                        font: '600 12px var(--ui)',
                        color: 'var(--ink-1)',
                        marginBottom: 2,
                      }}
                    >
                      {d.label}
                    </div>
                    <div
                      style={{
                        font: '600 16px var(--display)',
                        color: 'var(--ink-1)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fmtMoney(d.total, { cents: true })}
                    </div>
                    <div
                      style={{
                        font: '500 11px var(--ui)',
                        color: 'var(--ink-3)',
                        marginTop: 2,
                      }}
                    >
                      {(pct * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 180,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {employerTotals.map((e) => (
                  <div
                    key={e.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <CatDot hue={e.hue} />
                    <span
                      style={{
                        flex: 1,
                        font: '600 14px var(--ui)',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {e.label}
                    </span>
                    <span
                      style={{
                        font: '600 14px var(--display)',
                        color: 'var(--ink-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fmtMoney(e.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div
            className="card fx-card paychecks-summary-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--radius)',
              padding: 22,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  font: '600 12px var(--ui)',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Total Buffer
              </span>
              <span
                style={{
                  font: '600 10px var(--ui)',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-4)',
                  border: '1px solid var(--hair)',
                  borderRadius: 6,
                  padding: '2px 7px',
                }}
              >
                Current
              </span>
            </div>

            <div
              style={{
                font: '600 32px/1 var(--display)',
                letterSpacing: '-.02em',
                color: BUCKET_COLOR.bofa,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtMoney(totals.currentBuffer, { cents: true })}
            </div>

            <div
              style={{
                font: '500 12px/1.45 var(--ui)',
                color: 'var(--ink-3)',
              }}
            >
              Sub-$100 remainder after Vault / Rent / RH / CO / BofA on each
              received paycheck. Quietly accumulates in Chase.
            </div>

            <BufferSparkline
              series={bufferSeries}
              receivedCount={receivedCount}
              color={BUCKET_COLOR.bofa}
              height={56}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                font: '500 11.5px var(--ui)',
                color: 'var(--ink-3)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 'auto',
              }}
            >
              <span>
                {receivedCount} of {computed.length} paychecks received
              </span>
              <span>Projected {fmtMoney(totals.totalBuffer)}</span>
            </div>
          </div>
        </Reveal>

        <Reveal from="right" delay={160}>
          <div
            className="card fx-card paychecks-summary-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--radius)',
              padding: 22,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SectionLabel
              right={
                <span
                  style={{
                    font: '500 12px var(--ui)',
                    color: 'var(--pos-ink)',
                  }}
                >
                  {Math.round(collectedPct * 100)}% collected
                </span>
              }
            >
              Income collected so far
            </SectionLabel>
            <div
              style={{
                flex: 1,
                display: 'grid',
                placeItems: 'center',
                paddingBottom: 6,
              }}
            >
              <GaugeArc
                value={collectedPct}
                size={220}
                stroke={18}
                gradient={['var(--pos)', 'var(--accent)']}
                glow="color-mix(in oklch, var(--pos) 40%, transparent)"
              >
                <div style={{ textAlign: 'center', paddingBottom: 4 }}>
                  <div
                    style={{
                      font: '600 28px var(--display)',
                      letterSpacing: '-.02em',
                      color: 'var(--ink-1)',
                    }}
                  >
                    {fmtMoney(collected)}
                  </div>
                  <div
                    style={{
                      font: '500 12px var(--ui)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    of {fmtMoney(totalIncome)} summer income
                  </div>
                </div>
              </GaugeArc>
            </div>
          </div>
        </Reveal>
      </div>
      <style>{`
        .paychecks-alloc-inner {
          min-width: 0;
        }
        @media (max-width: 640px) {
          .paychecks-alloc-card {
            padding: 14px !important;
          }
          .paychecks-summary-card {
            padding: 16px !important;
          }
          .paychecks-alloc-scroll {
            overflow-x: auto;
          }
          .paychecks-alloc-inner {
            min-width: 560px;
          }
        }
        @media (max-width: 430px) {
          .paychecks-alloc-card {
            padding: 12px !important;
          }
          .paychecks-summary-card {
            padding: 14px !important;
          }
        }
      `}</style>
    </div>
  )
}

function Th({
  align,
  children,
}: {
  align: 'left' | 'center' | 'right'
  children: React.ReactNode
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '12px 8px',
        font: '600 10.5px var(--ui)',
        letterSpacing: '.03em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--hair)',
        position: 'sticky',
        top: 0,
        background: 'var(--surface)',
        zIndex: 1,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  align,
  last,
  children,
}: {
  align: 'left' | 'center' | 'right'
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <td
      style={{
        padding: '7px 8px',
        textAlign: align,
        borderBottom: last ? 'none' : '1px solid var(--hair)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}

function KV({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-background/70">{label}</span>
      <span>{v}</span>
    </div>
  )
}

function ReceivedCheck({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={checked ? 'Mark unreceived' : 'Mark received'}
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        cursor: 'pointer',
        display: 'inline-grid',
        placeItems: 'center',
        border: '1.5px solid',
        borderColor: checked ? 'var(--mint)' : 'var(--ink-4)',
        background: checked ? 'var(--mint)' : 'transparent',
        transition: 'all .15s',
        padding: 0,
      }}
    >
      {checked && <Check size={13} color="#fff" strokeWidth={2.6} />}
    </button>
  )
}

function MoneyCell({
  value,
  hue,
  muted,
}: {
  value: number
  hue?: number
  muted?: boolean
}) {
  const isZero = !value || value <= 0
  const color = muted
    ? 'var(--ink-3)'
    : hue != null && value > 0
      ? `oklch(0.55 0.14 ${hue})`
      : 'var(--ink-2)'
  return (
    <span
      style={{
        font: `${muted ? 500 : 600} 13px var(--display)`,
        color: isZero && !muted ? 'var(--ink-4)' : color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {isZero && !muted ? '' : fmtMoney(value, { cents: true })}
    </span>
  )
}

function NumberCell({
  value,
  step,
  placeholder,
  align = 'center',
  strong,
  last,
  onCommit,
}: {
  value: number | null
  step: string
  placeholder?: string
  align?: 'left' | 'center' | 'right'
  strong?: boolean
  last?: boolean
  onCommit: (v: string) => void
}) {
  const initial = value == null ? '' : String(value)
  return (
    <Td align={align} last={last}>
      <input
        key={initial}
        type="number"
        step={step}
        defaultValue={initial}
        placeholder={placeholder ?? '0'}
        className={cn(
          'w-full bg-transparent outline-none border-0 px-1 py-1 rounded-md',
          'focus:bg-[var(--surface-2)] focus:ring-1 focus:ring-[var(--accent)]',
          'transition-colors',
        )}
        style={{
          textAlign: align,
          font: `${strong ? 600 : 500} 13px var(--ui)`,
          color: 'var(--ink-1)',
          fontVariantNumeric: 'tabular-nums',
        }}
        onBlur={(e) => {
          const raw = e.currentTarget.value
          if (raw !== initial) onCommit(raw)
        }}
      />
    </Td>
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
          className={cn('size-4')}
          style={{
            color: hasNotes ? 'var(--accent-ink)' : 'var(--ink-4)',
          }}
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

type AllocSegment = { key: string; value: number; hue: number }
type AllocBar = {
  label: string
  employer: 'USC' | 'NTT'
  received: boolean
  isNext: boolean
  segments: AllocSegment[]
}

function BufferSparkline({
  series,
  receivedCount,
  color,
  height = 56,
}: {
  series: number[]
  receivedCount: number
  color: string
  height?: number
}) {
  if (series.length < 2) return null
  const max = Math.max(1, ...series)
  const min = Math.min(0, ...series)
  const rng = max - min || 1
  const pad = 4
  const innerH = height - pad * 2
  const W = 200
  const points = series.map((v, i) => ({
    x: (i / (series.length - 1)) * W,
    y: pad + innerH - ((v - min) / rng) * innerH,
  }))
  const splitIdx = Math.max(0, Math.min(series.length - 1, receivedCount))

  const solid = points.slice(0, splitIdx + 1)
  const dashed = points.slice(splitIdx)

  const toPath = (pts: typeof points) =>
    pts.length === 0
      ? ''
      : pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const solidPath = toPath(solid)
  const dashedPath = toPath(dashed)

  const lastSolid = solid[solid.length - 1]

  // Area fill under the entire curve (solid + dashed) so the buffer card
  // gets the same light wash as the dashboard's Vault Growth area. The
  // gradient uses the buffer line color, matching the sparkline.
  const allPoints = points
  const fullLinePath = toPath(allPoints)
  const areaPath =
    allPoints.length > 1
      ? `${fullLinePath} L ${allPoints[allPoints.length - 1].x} ${pad + innerH} L ${allPoints[0].x} ${pad + innerH} Z`
      : ''
  const gradId = 'buffer-grad'

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      {solidPath && (
        <path
          d={solidPath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {dashedPath && dashed.length > 1 && (
        <path
          d={dashedPath}
          fill="none"
          stroke={color}
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeDasharray="3 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {lastSolid && (
        <circle
          cx={lastSolid.x}
          cy={lastSolid.y}
          r="3"
          fill={color}
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}

function AllocationChart({
  bars,
  max,
  height = 240,
}: {
  bars: AllocBar[]
  max: number
  height?: number
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const totals = bars.map((b) => b.segments.reduce((s, x) => s + x.value, 0))
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
      }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {bars.map((b, i) => {
        const total = totals[i]
        const heightPct = (total / max) * 100
        const isHover = hoverIdx === i
        return (
          <div
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              gap: 6,
              minWidth: 0,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                font: '600 10px var(--ui)',
                color:
                  isHover || b.isNext ? 'var(--ink-1)' : 'var(--ink-3)',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              ${(total / 1000).toFixed(1)}k
            </div>
            <div
              style={{
                flex: 1,
                width: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 34,
                  height: `${heightPct}%`,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '8px 8px 4px 4px',
                  overflow: 'hidden',
                  outline: b.isNext
                    ? '2px solid var(--accent)'
                    : 'none',
                  outlineOffset: 2,
                  boxShadow: isHover
                    ? '0 8px 24px -8px color-mix(in oklch, var(--accent) 45%, transparent)'
                    : 'none',
                  filter: b.received ? 'none' : 'saturate(0.65)',
                  opacity: hoverIdx == null || isHover ? 1 : 0.55,
                  transition:
                    'opacity 150ms ease, box-shadow 150ms ease, transform 150ms ease',
                  transform: isHover ? 'translateY(-2px)' : 'none',
                }}
              >
                {b.segments.map((s, si) =>
                  s.value > 0 ? (
                    <div
                      key={si}
                      style={{
                        height: `${(s.value / (total || 1)) * 100}%`,
                        background: colorForHue(s.hue),
                      }}
                    />
                  ) : null,
                )}
              </div>
              {isHover && (
                <AllocTooltip bar={b} total={total} />
              )}
            </div>
            <div
              style={{
                font: '500 10.5px var(--ui)',
                color: b.isNext ? 'var(--accent)' : 'var(--ink-3)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {b.received ? (
                <Check className="size-3" style={{ color: 'var(--pos-ink)' }} />
              ) : null}
              {b.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AllocTooltip({ bar, total }: { bar: AllocBar; total: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface-2)',
        border: '1px solid var(--hair)',
        borderRadius: 10,
        padding: '10px 12px',
        font: '500 12px var(--ui)',
        color: 'var(--ink-1)',
        minWidth: 180,
        boxShadow: '0 12px 32px -10px color-mix(in oklch, black 50%, transparent)',
        pointerEvents: 'none',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--hair)',
        }}
      >
        <span style={{ font: '600 12.5px var(--ui)' }}>
          {bar.label} · {bar.employer}
        </span>
        <span
          style={{
            font: '600 10px var(--ui)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            color: bar.received ? 'var(--pos-ink)' : 'var(--ink-3)',
          }}
        >
          {bar.received ? 'Received' : bar.isNext ? 'Next' : 'Pending'}
        </span>
      </div>
      {bar.segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '2px 0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: colorForHue(s.hue),
                }}
              />
              {s.key}
            </span>
            <span style={{ color: 'var(--ink-2)' }}>
              {fmtMoney(s.value, { cents: false })}
            </span>
          </div>
        ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          paddingTop: 6,
          borderTop: '1px solid var(--hair)',
          font: '600 12px var(--ui)',
        }}
      >
        <span style={{ color: 'var(--ink-3)' }}>Total</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmtMoney(total, { cents: false })}
        </span>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tag,
  sub,
  hue,
  progress,
}: {
  label: string
  value: string
  tag?: string
  sub?: string
  hue?: number
  progress?: number
}) {
  return (
    <div
      className="card fx-card"
      style={{
        padding: 18,
        height: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            font: '600 12px var(--ui)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
          }}
        >
          {label}
        </span>
        {tag && (
          <span
            style={{
              font: '600 10px var(--ui)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-4)',
              border: '1px solid var(--hair)',
              borderRadius: 6,
              padding: '2px 7px',
            }}
          >
            {tag}
          </span>
        )}
      </div>
      <div
        style={{
          font: '600 28px/1 var(--display)',
          letterSpacing: '-.02em',
          color: hue != null ? `oklch(0.6 0.16 ${hue})` : 'var(--ink-1)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            font: '500 12px var(--ui)',
            color: 'var(--ink-3)',
            marginTop: 7,
          }}
        >
          {sub}
        </div>
      )}
      {progress != null && (
        <div style={{ marginTop: 10 }}>
          <ProgressBar
            pct={progress}
            color={`linear-gradient(90deg, oklch(0.7 0.16 ${hue ?? 45}), var(--accent))`}
          />
        </div>
      )}
    </div>
  )
}

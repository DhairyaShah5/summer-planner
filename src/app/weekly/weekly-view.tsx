'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import {
  PageHeader,
  SectionLabel,
  Reveal,
  Money,
  AreaChart,
  fmtMoney,
} from '@/components/redesign'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { logRolloverSweep } from './sweep-actions'

export type WeeklyRow = {
  index: number
  startISO: string
  endISO: string
  startLabel: string
  endLabel: string
  budget: number
  spent: number
  variance: number
  vaultBalance: number
  status: 'Past' | 'Current' | 'Future'
}

type Props = {
  weeks: WeeklyRow[]
  summerRemaining: number
  totalActualToDate: number
  totalSummerCO: number
  rolloverSurplus: number
  suggestedSweep: number
  threshold: number
  cushion: number
  showBanner: boolean
  chaseAccountId: string
  bofaAccountId: string
}

const POS = 'var(--pos)'
const POS_INK = 'var(--pos-ink)'

function todayISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

function tdStyle(i: number, len: number, align: 'left' | 'right'): React.CSSProperties {
  return {
    padding: '11px 14px',
    textAlign: align,
    borderBottom: i < len - 1 ? '1px solid var(--hair)' : 'none',
    whiteSpace: 'nowrap',
  }
}

function mono(): React.CSSProperties {
  return {
    font: '600 13px var(--display)',
    color: 'var(--ink-1)',
    fontVariantNumeric: 'tabular-nums',
  }
}

function WeekStatusPill({ s }: { s: WeeklyRow['status'] }) {
  const map: Record<WeeklyRow['status'], { bg: string; fg: string }> = {
    Past: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
    Current: {
      bg: 'color-mix(in oklch, var(--accent) 16%, transparent)',
      fg: 'var(--accent-ink)',
    },
    Future: {
      bg: 'color-mix(in oklch, var(--gold) 18%, transparent)',
      fg: 'color-mix(in oklch, var(--gold) 70%, var(--ink-1))',
    },
  }
  const t = map[s]
  return (
    <span
      style={{
        font: '600 11px var(--ui)',
        padding: '3px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
      }}
    >
      {s}
    </span>
  )
}

type SweepBannerProps = {
  rolloverSurplus: number
  suggestedSweep: number
  cushion: number
  onSweep: () => void
}

function SweepBanner({
  rolloverSurplus,
  suggestedSweep,
  cushion,
  onSweep,
}: SweepBannerProps) {
  return (
    <div
      className="fx-card"
      style={{
        padding: '16px 20px',
        marginBottom: 18,
        borderRadius: 'var(--radius)',
        border: '1px solid color-mix(in oklch, var(--gold) 35%, var(--hair))',
        borderLeft: '4px solid var(--gold)',
        background:
          'color-mix(in oklch, var(--gold) 8%, var(--surface))',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: '600 22px/1.15 var(--display)',
            letterSpacing: '-.02em',
            color: 'var(--ink-1)',
          }}
        >
          <Money value={rolloverSurplus} cents dur={900} /> carried over from
          earlier weeks
        </div>
        <div
          style={{
            font: '500 13.5px var(--ui)',
            color: 'var(--ink-2)',
            marginTop: 4,
          }}
        >
          Sweep {fmtMoney(suggestedSweep, { cents: true })} to BofA Checking?
          Keeps a {fmtMoney(cushion, { cents: true })} cushion in Chase.
        </div>
      </div>
      <Button
        type="button"
        onClick={onSweep}
        style={{
          background: 'var(--accent)',
          color: 'white',
          whiteSpace: 'nowrap',
        }}
      >
        Sweep {fmtMoney(suggestedSweep, { cents: true })} to BofA
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  )
}

export function WeeklyView({
  weeks,
  summerRemaining,
  totalActualToDate,
  totalSummerCO,
  rolloverSurplus,
  suggestedSweep,
  threshold: _threshold,
  cushion,
  showBanner,
  chaseAccountId,
  bofaAccountId,
}: Props) {
  void _threshold
  const router = useRouter()
  const summerIsUnder = summerRemaining >= 0

  const [sweepOpen, setSweepOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const sweepDate = todayISO()

  function handleConfirmSweep() {
    if (!chaseAccountId || !bofaAccountId) {
      toast.error('Missing Chase or BofA account')
      return
    }
    if (suggestedSweep <= 0) {
      toast.error('Nothing to sweep')
      return
    }
    startTransition(async () => {
      const res = await logRolloverSweep({
        fromAccountId: chaseAccountId,
        toAccountId: bofaAccountId,
        amount: suggestedSweep,
        transferredAt: sweepDate,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not record sweep')
        return
      }
      toast.success(
        `${fmtMoney(suggestedSweep, { cents: true })} swept to BofA`,
      )
      setSweepOpen(false)
      router.refresh()
    })
  }

  const series = [
    {
      name: 'Spending Budget',
      color: 'var(--ink-2)',
      fill: false,
      points: weeks.map((w, i) => ({
        x: i % 2 === 0 ? w.endLabel : '',
        y: w.budget,
      })),
    },
    {
      name: 'Actual Spent',
      color: 'var(--accent)',
      fill: true,
      points: weeks.map((w, i) => ({
        x: i % 2 === 0 ? w.endLabel : '',
        y: w.spent,
      })),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        title="Weekly Tracker"
        subtitle="Maximum allowed to spend (cumulative) vs actual spent · week ending Sunday."
      />

      {showBanner && (
        <Reveal>
          <SweepBanner
            rolloverSurplus={rolloverSurplus}
            suggestedSweep={suggestedSweep}
            cushion={cushion}
            onSweep={() => setSweepOpen(true)}
          />
        </Reveal>
      )}

      <Reveal>
        <div
          className="fx-card"
          style={{
            padding: '16px 20px',
            marginBottom: 18,
            borderLeft: `4px solid ${summerIsUnder ? POS : 'var(--accent)'}`,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderLeftWidth: 4,
            borderRadius: 'var(--radius)',
          }}
        >
          <span
            style={{
              font: '600 26px/1 var(--display)',
              letterSpacing: '-.02em',
              color: summerIsUnder ? POS_INK : 'var(--accent-ink)',
            }}
          >
            <Money value={Math.abs(summerRemaining)} cents dur={900} />
          </span>
          <span style={{ font: '500 14px var(--ui)', color: 'var(--ink-2)' }}>
            {summerIsUnder
              ? 'left to spend this summer'
              : 'over budget for the summer'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              font: '500 12.5px var(--ui)',
              color: 'var(--ink-3)',
            }}
          >
            Spent {fmtMoney(totalActualToDate, { cents: true })} of{' '}
            {fmtMoney(totalSummerCO, { cents: true })} projected CO
          </span>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div
          className="fx-card"
          style={{
            padding: 22,
            marginBottom: 18,
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius)',
          }}
        >
          <SectionLabel
            right={
              <div style={{ display: 'flex', gap: 14 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    font: '500 12px var(--ui)',
                    color: 'var(--ink-3)',
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 3,
                      borderRadius: 2,
                      background: 'var(--accent)',
                    }}
                  />
                  Actual spent
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    font: '500 12px var(--ui)',
                    color: 'var(--ink-3)',
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 3,
                      borderRadius: 2,
                      background: 'var(--ink-2)',
                    }}
                  />
                  Spending budget
                </span>
              </div>
            }
          >
            Spending vs Budget
          </SectionLabel>
          <AreaChart series={series} width={720} height={250} />
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div
          className="fx-card"
          style={{
            padding: 22,
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius)',
          }}
        >
          <SectionLabel>Weekly Breakdown</SectionLabel>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                minWidth: 720,
              }}
            >
              <thead>
                <tr>
                  {[
                    'Week',
                    'Start',
                    'End',
                    'Spending Budget',
                    'Actual Spent',
                    'Variance',
                    'Vault Balance',
                    'Status',
                  ].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i > 2 ? 'right' : 'left',
                        padding: '11px 14px',
                        font: '600 11px var(--ui)',
                        letterSpacing: '.04em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid var(--hair)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, i) => (
                  <tr
                    key={w.index}
                    style={{
                      background:
                        w.status === 'Current'
                          ? 'color-mix(in oklch, var(--accent) 7%, transparent)'
                          : 'transparent',
                    }}
                  >
                    <td style={tdStyle(i, weeks.length, 'left')}>
                      <span
                        style={{
                          font: '600 13px var(--display)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {w.index}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'left')}>
                      <span
                        style={{
                          font: '500 13px var(--ui)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {w.startLabel}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'left')}>
                      <span
                        style={{
                          font: '500 13px var(--ui)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {w.endLabel}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'right')}>
                      <span style={mono()}>
                        {fmtMoney(w.budget, { cents: true })}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'right')}>
                      <span style={mono()}>
                        {fmtMoney(w.spent, { cents: true })}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'right')}>
                      <span
                        style={{
                          ...mono(),
                          color:
                            w.variance < 0
                              ? 'var(--accent-ink)'
                              : POS_INK,
                        }}
                      >
                        {w.variance < 0 ? '−' : ''}
                        {fmtMoney(Math.abs(w.variance), { cents: true })}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'right')}>
                      <span style={mono()}>
                        {fmtMoney(w.vaultBalance, { cents: true })}
                      </span>
                    </td>
                    <td style={tdStyle(i, weeks.length, 'right')}>
                      <WeekStatusPill s={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      {/* Sweep confirmation dialog */}
      <Dialog
        open={sweepOpen}
        onOpenChange={(open) => {
          if (!pending) setSweepOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Sweep {fmtMoney(suggestedSweep, { cents: true })} to BofA
              Checking?
            </DialogTitle>
            <DialogDescription>
              This will record a transfer from Chase Checking to BofA Checking
              dated today, marked as a rollover sweep. Your Chase balance will
              drop by {fmtMoney(suggestedSweep, { cents: true })}; BofA will
              grow by the same. This action is reversible — you can delete the
              transfer from the Accounts page if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--hair)',
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  font: '600 10.5px var(--ui)',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                From
              </div>
              <div
                style={{
                  font: '600 14px var(--ui)',
                  color: 'var(--ink-1)',
                  marginTop: 2,
                }}
              >
                Chase Checking
              </div>
            </div>
            <ArrowRightIcon
              className="size-4"
              style={{ color: 'var(--ink-3)' }}
            />
            <div>
              <div
                style={{
                  font: '600 10.5px var(--ui)',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                To
              </div>
              <div
                style={{
                  font: '600 14px var(--ui)',
                  color: 'var(--ink-1)',
                  marginTop: 2,
                }}
              >
                BofA Checking
              </div>
            </div>
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 10,
                marginTop: 4,
                borderTop: '1px solid var(--hair)',
                font: '500 12.5px var(--ui)',
                color: 'var(--ink-2)',
              }}
            >
              <span>
                Amount:{' '}
                <span
                  style={{
                    font: '600 13.5px var(--display)',
                    color: 'var(--ink-1)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtMoney(suggestedSweep, { cents: true })}
                </span>
              </span>
              <span>
                Date:{' '}
                <span
                  style={{
                    font: '600 13.5px var(--display)',
                    color: 'var(--ink-1)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sweepDate}
                </span>
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => setSweepOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmSweep} disabled={pending}>
              {pending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Sweeping...
                </>
              ) : (
                'Confirm sweep'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

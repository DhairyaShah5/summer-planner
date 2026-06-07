'use client'

import {
  PageHeader,
  SectionLabel,
  Reveal,
  Money,
  AreaChart,
  fmtMoney,
} from '@/components/redesign'

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
}

const POS = 'var(--pos)'
const POS_INK = 'var(--pos-ink)'

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

export function WeeklyView({
  weeks,
  summerRemaining,
  totalActualToDate,
  totalSummerCO,
}: Props) {
  const summerIsUnder = summerRemaining >= 0

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
    </div>
  )
}

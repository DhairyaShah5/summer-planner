'use client'

import { useMemo, useState } from 'react'
import type { Expense } from '@/lib/types'
import {
  BarChart,
  CatDot,
  Donut,
  Reveal,
  SectionLabel,
  fmtMoney,
} from '@/components/redesign'
import { Card, CardContent } from '@/components/ui/card'
import { hueForCategory } from './categories'

const WEEK_WINDOW = 4

function mondayKey(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  const day = (dt.getDay() + 6) % 7 // Mon = 0
  dt.setDate(dt.getDate() - day)
  return dt.toISOString().slice(0, 10)
}

function weekLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props {
  expenses: Expense[]
}

export function ExpenseCharts({ expenses }: Props) {
  // Off-budget expenses are excluded from category and weekly aggregations.
  const budgetedExpenses = useMemo(
    () => expenses.filter((e) => e.count_in_co_budget !== false),
    [expenses],
  )

  const byCat = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of budgetedExpenses) {
      const key = (e.category || 'Other').trim() || 'Other'
      totals.set(key, (totals.get(key) ?? 0) + e.amount)
    }
    return Array.from(totals.entries())
      .map(([label, total]) => ({ label, total, hue: hueForCategory(label) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [budgetedExpenses])

  const catTotal = byCat.reduce((s, c) => s + c.total, 0) || 1

  const bars = useMemo(() => {
    const wk = new Map<string, number>()
    for (const e of budgetedExpenses) {
      const k = mondayKey(e.expense_date)
      wk.set(k, (wk.get(k) ?? 0) + e.amount)
    }
    return Array.from(wk.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        label: weekLabel(k),
        value: v,
        color: 'var(--accent)',
      }))
  }, [budgetedExpenses])

  const maxPageStart = Math.max(0, bars.length - WEEK_WINDOW)
  const [pageStart, setPageStart] = useState(maxPageStart)
  const clampedStart = Math.min(pageStart, maxPageStart)
  const visibleBars = bars.slice(clampedStart, clampedStart + WEEK_WINDOW)
  const canGoLeft = clampedStart > 0
  const canGoRight = clampedStart < maxPageStart

  if (byCat.length === 0) return null

  return (
    <div
      className="expense-charts-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: 16,
        marginBottom: 18,
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .expense-charts-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <Reveal from="left">
        <Card style={{ padding: 20, height: '100%' }}>
          <CardContent
            style={{
              padding: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SectionLabel>By category</SectionLabel>
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                flex: 1,
              }}
            >
              <Donut
                data={byCat}
                size={140}
                stroke={20}
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
                  minWidth: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {byCat.map((c) => (
                  <div
                    key={c.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <CatDot hue={c.hue} />
                    <span
                      style={{
                        flex: 1,
                        font: '500 12.5px var(--ui)',
                        color: 'var(--ink-2)',
                      }}
                    >
                      {c.label}
                    </span>
                    <span
                      style={{
                        font: '600 12.5px var(--display)',
                        color: 'var(--ink-1)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Math.round((c.total / catTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Reveal>
      <Reveal from="right">
        <Card style={{ padding: 20, height: '100%' }}>
          <CardContent style={{ padding: 0 }}>
            <SectionLabel
              right={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <WeekArrowButton
                    direction="left"
                    disabled={!canGoLeft}
                    onClick={() =>
                      setPageStart(Math.max(0, clampedStart - WEEK_WINDOW))
                    }
                  />
                  <span
                    style={{
                      font: '500 12px var(--ui)',
                      color: 'var(--ink-3)',
                      minWidth: 52,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {bars.length > 0
                      ? `${clampedStart + 1}–${Math.min(
                          bars.length,
                          clampedStart + WEEK_WINDOW,
                        )} / ${bars.length}`
                      : 'per week'}
                  </span>
                  <WeekArrowButton
                    direction="right"
                    disabled={!canGoRight}
                    onClick={() =>
                      setPageStart(
                        Math.min(maxPageStart, clampedStart + WEEK_WINDOW),
                      )
                    }
                  />
                </div>
              }
            >
              Spending by week
            </SectionLabel>
            <BarChart
              bars={visibleBars}
              height={190}
              formatTop={(v) => '$' + v.toFixed(0)}
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}

function WeekArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? 'Previous weeks' : 'Next weeks'}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 26,
        height: 26,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 6,
        border: '1px solid var(--hair)',
        background: 'var(--surface-2)',
        color: disabled ? 'var(--ink-4)' : 'var(--ink-2)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 140ms ease',
        padding: 0,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === 'left' ? (
          <polyline points="7.5 2.5 3.5 6 7.5 9.5" />
        ) : (
          <polyline points="4.5 2.5 8.5 6 4.5 9.5" />
        )}
      </svg>
    </button>
  )
}

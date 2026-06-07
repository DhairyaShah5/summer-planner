'use client'

import { useMemo } from 'react'
import type { Expense } from '@/lib/types'
import {
  BarChart,
  CatDot,
  Donut,
  Reveal,
  SectionLabel,
} from '@/components/redesign'
import { Card, CardContent } from '@/components/ui/card'
import { hueForCategory } from './categories'

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
  const byCat = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of expenses) {
      const key = (e.category || 'Other').trim() || 'Other'
      totals.set(key, (totals.get(key) ?? 0) + e.amount)
    }
    return Array.from(totals.entries())
      .map(([label, total]) => ({ label, total, hue: hueForCategory(label) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  const catTotal = byCat.reduce((s, c) => s + c.total, 0) || 1

  const bars = useMemo(() => {
    const wk = new Map<string, number>()
    for (const e of expenses) {
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
  }, [expenses])

  if (byCat.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: 16,
        marginBottom: 18,
      }}
      className="grid-cols-1 sm:grid-cols-[1fr_1.2fr]"
    >
      <Reveal from="left">
        <Card style={{ padding: 20, height: '100%' }}>
          <CardContent style={{ padding: 0 }}>
            <SectionLabel>By category</SectionLabel>
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Donut data={byCat} size={140} stroke={20} />
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
                <span
                  style={{
                    font: '500 12px var(--ui)',
                    color: 'var(--ink-3)',
                  }}
                >
                  per week
                </span>
              }
            >
              Spending by week
            </SectionLabel>
            <BarChart
              bars={bars}
              height={190}
              formatTop={(v) => '$' + v.toFixed(0)}
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}

'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = {
  Vault: '#6366f1', // indigo
  Rent: '#f59e0b', // amber
  Robinhood: '#10b981', // emerald
  CO: '#3b82f6', // blue
  Buffer: '#a855f7', // purple
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export interface AllocationDatum {
  name: keyof typeof COLORS
  value: number
}

export function AllocationBreakdown({ data }: { data: AllocationDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add paychecks to see your projected summer allocation.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={64}
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive
              animationDuration={900}
              animationBegin={150}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={COLORS[d.name]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, name) => [money.format(Number(v)), String(name)]}
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
        {data.map((d) => {
          const pct = total ? (d.value / total) * 100 : 0
          return (
            <li
              key={d.name}
              className="flex items-center justify-between gap-2 tabular-nums"
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-sm"
                  style={{ backgroundColor: COLORS[d.name] }}
                />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="font-medium text-muted-foreground">
                {pct.toFixed(0)}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

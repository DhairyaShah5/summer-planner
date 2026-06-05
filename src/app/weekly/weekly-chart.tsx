'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface WeeklyChartPoint {
  weekEnd: string
  target: number
  actual: number
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function WeeklyChart({ data }: { data: WeeklyChartPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <defs>
            <linearGradient id="targetFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="weekEnd"
            tick={{ fontSize: 12 }}
            tickMargin={8}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => money.format(v as number)}
            width={72}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            formatter={(v) => money.format(Number(v))}
            labelClassName="text-foreground"
            contentStyle={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area
            type="monotone"
            dataKey="target"
            name="Target Cumulative"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#targetFill)"
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual Cumulative"
            stroke="var(--destructive)"
            strokeWidth={2.5}
            fill="url(#actualFill)"
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

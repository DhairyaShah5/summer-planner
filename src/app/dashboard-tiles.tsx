'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  Vault,
  Calendar,
  Wallet,
  TrendingUp,
  Receipt,
  ClipboardList,
  Inbox,
  Sparkles,
  PieChart,
  Landmark,
  ArrowUpRight,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GradientProgress } from '@/components/gradient-progress'
import { AnimatedNumber } from '@/components/animated-number'
import { MotionTile } from '@/components/motion-card'
import {
  AllocationBreakdown,
  type AllocationDatum,
} from '@/components/allocation-breakdown'
import type { Expense } from '@/lib/types'
import { cn } from '@/lib/utils'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const tileChrome =
  'relative h-full ring-1 ring-foreground/10 transition-shadow hover:shadow-lg group-hover:ring-2 group-hover:ring-primary/20'

const tileArrowClass =
  'pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'

export interface DashboardTilesProps {
  vault: {
    current: number
    projected: number
    cap: number
    percent: number
    remaining: number
  }
  weekBudget: {
    weekStartLabel: string
    weekEndLabel: string
    variance: number
    isUnder: boolean
    actual: number
    target: number
  }
  nextPaycheck:
    | {
        payDateLabel: string
        employer: string
        status: 'Received' | 'Pending'
        projectedNet: number
        vault: number
        co: number
      }
    | null
  projected: {
    totalVault: number
    totalCO: number
    totalBuffer: number
    totalRentPaid: number
  }
  paycheckStatus: {
    pending: number
    received: number
    total: number
  }
  recentExpenses: Expense[]
  allocation: AllocationDatum[]
  accountsPreview: {
    id: string
    name: string
    type: 'checking' | 'credit_card' | 'hysa'
    current_balance: number
  }[]
}

export function DashboardTiles(props: DashboardTilesProps) {
  const {
    vault,
    weekBudget,
    nextPaycheck,
    projected,
    paycheckStatus,
    recentExpenses,
    allocation,
    accountsPreview,
  } = props

  return (
    <div className="space-y-4">
      {/* Top row: Vault hero (col-span-2) + This Week CO Budget (col-span-1) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[1fr]">
        <MotionTile index={0} className="md:col-span-2">
          <Link href="/paychecks" className="group block h-full">
            <Card
              className={cn(
                tileChrome,
                'bg-gradient-to-br from-indigo-500/10 via-fuchsia-500/5 to-transparent',
              )}
            >
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <motion.span
                    whileHover={{ rotate: 12, scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="inline-flex"
                  >
                    <Vault className="size-4 text-indigo-500" />
                  </motion.span>
                  Vault Progress
                </CardTitle>
                <CardDescription className="tabular-nums">
                  <AnimatedNumber value={vault.current} format={money.format} />{' '}
                  today &middot; projected{' '}
                  {moneyWhole.format(vault.projected)} by Aug 28
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-semibold tracking-tight tabular-nums">
                  <AnimatedNumber value={vault.current} format={money.format} />
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Saving toward {moneyWhole.format(vault.cap)} (
                  {vault.percent.toFixed(1)}% of the way)
                </p>
                <GradientProgress percent={vault.percent} height="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{vault.percent.toFixed(1)}% funded</span>
                  <span>
                    {money.format(vault.remaining)} to{' '}
                    {moneyWhole.format(vault.cap)} cap
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </MotionTile>

        <MotionTile index={1}>
          <Link href="/expenses" className="group block h-full">
            <Card
              className={cn(
                tileChrome,
                'border-l-4',
                weekBudget.isUnder
                  ? 'border-l-emerald-500'
                  : 'border-l-rose-500',
              )}
            >
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  CO Budget
                </CardTitle>
                <CardDescription>
                  {weekBudget.weekStartLabel} - {weekBudget.weekEndLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div
                  className={cn(
                    'text-3xl font-semibold tracking-tight tabular-nums',
                    weekBudget.isUnder
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  <AnimatedNumber
                    value={Math.abs(weekBudget.variance)}
                    format={money.format}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {weekBudget.isUnder
                    ? 'left to spend overall'
                    : 'over budget overall'}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Spent {money.format(weekBudget.actual)} &middot; Maximum allowed{' '}
                  {money.format(weekBudget.target)}
                </p>
              </CardContent>
            </Card>
          </Link>
        </MotionTile>
      </div>

      {/* Middle row: 3 columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[1fr]">
        <MotionTile index={2}>
          <Link href="/paychecks" className="group block h-full">
            <Card className={tileChrome}>
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  Next Paycheck
                </CardTitle>
                <CardDescription>
                  {nextPaycheck
                    ? nextPaycheck.payDateLabel
                    : 'No paychecks scheduled'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nextPaycheck ? (
                  <>
                    <div className="flex items-center justify-between">
                      <EmployerBadge employer={nextPaycheck.employer} />
                      <StatusBadge status={nextPaycheck.status} />
                    </div>
                    <div className="space-y-1.5">
                      <RowLine
                        label="Projected net"
                        value={money.format(nextPaycheck.projectedNet)}
                      />
                      <RowLine
                        label="Vault"
                        value={money.format(nextPaycheck.vault)}
                      />
                      <RowLine
                        label="CO spend"
                        value={money.format(nextPaycheck.co)}
                      />
                    </div>
                  </>
                ) : (
                  <EmptyHint
                    icon={<Sparkles className="size-5 text-muted-foreground" />}
                    title="No paychecks yet"
                    body="Add a paycheck on the Paychecks page."
                  />
                )}
              </CardContent>
            </Card>
          </Link>
        </MotionTile>

        <MotionTile index={3}>
          <Link href="/paychecks" className="group block h-full">
            <Card className={tileChrome}>
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  Projected (end of summer)
                </CardTitle>
                <CardDescription>
                  Projected allocations across summer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <ProjectedStat
                    label="Vault"
                    value={money.format(projected.totalVault)}
                  />
                  <ProjectedStat
                    label="CO"
                    value={money.format(projected.totalCO)}
                  />
                  <ProjectedStat
                    label="Buffer"
                    value={money.format(projected.totalBuffer)}
                  />
                  <ProjectedStat
                    label="Rent paid"
                    value={money.format(projected.totalRentPaid)}
                  />
                </dl>
              </CardContent>
            </Card>
          </Link>
        </MotionTile>

        <MotionTile index={4}>
          <Link href="/paychecks" className="group block h-full">
            <Card className={tileChrome}>
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-amber-500" />
                  Paycheck Status
                </CardTitle>
                <CardDescription>
                  {paycheckStatus.pending} pending of {paycheckStatus.total} total
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    <AnimatedNumber
                      value={paycheckStatus.pending}
                      format={(n) => String(Math.round(n))}
                    />
                  </span>
                  <span className="text-sm text-muted-foreground">pending</span>
                </div>
                <div className="flex gap-2">
                  <StatusBadge
                    status="Received"
                    count={paycheckStatus.received}
                  />
                  <StatusBadge
                    status="Pending"
                    count={paycheckStatus.pending}
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        </MotionTile>
      </div>

      {/* Bottom row: 3 columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[1fr]">
        <MotionTile index={5}>
          <Link href="/accounts" className="group block h-full">
            <Card className={tileChrome}>
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="size-4 text-indigo-500" />
                  Accounts
                </CardTitle>
                <CardDescription>Live balances right now</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {accountsPreview.length > 0 ? (
                  <ul className="divide-y">
                    {accountsPreview.map((a, i) => {
                      const isCC = a.type === 'credit_card'
                      return (
                        <motion.li
                          key={a.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
                          className="-mx-2 flex items-center justify-between rounded px-2 py-2 first:pt-0 last:pb-0 transition-colors hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {a.name}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {accountTypeLabel(a.type)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'ml-3 text-sm font-semibold tabular-nums',
                              isCC && 'text-destructive',
                            )}
                          >
                            {money.format(a.current_balance)}
                          </span>
                        </motion.li>
                      )
                    })}
                  </ul>
                ) : (
                  <EmptyHint
                    icon={<Landmark className="size-5 text-muted-foreground" />}
                    title="No accounts yet"
                    body="Seed accounts in the database to see balances here."
                  />
                )}
              </CardContent>
            </Card>
          </Link>
        </MotionTile>

        <MotionTile index={6}>
          <Link href="/expenses" className="group block h-full">
            <Card className={tileChrome}>
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-4 text-rose-500" />
                  Recent Expenses
                </CardTitle>
                <CardDescription>
                  {recentExpenses.length > 0
                    ? `Last ${recentExpenses.length} entries`
                    : 'Nothing logged yet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentExpenses.length > 0 ? (
                  <ul className="divide-y">
                    {recentExpenses.map((e, i) => (
                      <motion.li
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
                        className="-mx-2 flex items-center justify-between rounded px-2 py-2 first:pt-0 last:pb-0 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {e.description}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(e.expense_date), 'MMM d')}
                          </p>
                        </div>
                        <span className="ml-3 text-sm font-medium tabular-nums">
                          {money.format(e.amount)}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <EmptyHint
                    icon={<Inbox className="size-5 text-muted-foreground" />}
                    title="No expenses yet"
                    body="Log spend on the Expenses page to see it here."
                  />
                )}
              </CardContent>
            </Card>
          </Link>
        </MotionTile>

        <MotionTile index={7}>
          <Link href="/paychecks" className="group block h-full">
            <Card className={tileChrome}>
              <ArrowUpRight className={tileArrowClass} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="size-4 text-fuchsia-500" />
                  Allocation Breakdown
                </CardTitle>
                <CardDescription>
                  Allocated so far, by bucket
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationBreakdown data={allocation} />
              </CardContent>
            </Card>
          </Link>
        </MotionTile>
      </div>
    </div>
  )
}

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function ProjectedStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function EmptyHint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="flex flex-col items-center justify-center gap-2 py-6 text-center"
    >
      <div className="rounded-full bg-muted p-3">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
    </motion.div>
  )
}

function accountTypeLabel(t: 'checking' | 'credit_card' | 'hysa'): string {
  switch (t) {
    case 'checking':
      return 'Checking'
    case 'credit_card':
      return 'Credit Card'
    case 'hysa':
      return 'HYSA'
  }
}

function EmployerBadge({ employer }: { employer: string }) {
  const isUSC = employer === 'USC On-Campus'
  return (
    <Badge
      className={
        isUSC
          ? 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 font-normal'
          : 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 font-normal'
      }
    >
      {isUSC ? 'USC' : 'NTT'}
    </Badge>
  )
}

function StatusBadge({
  status,
  count,
}: {
  status: 'Received' | 'Pending'
  count?: number
}) {
  const label = count == null ? status : `${count} ${status.toLowerCase()}`
  if (status === 'Received') {
    return <Badge variant="default">{label}</Badge>
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 font-normal">
      {label}
    </Badge>
  )
}

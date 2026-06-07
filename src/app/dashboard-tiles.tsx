'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Vault,
  Calendar,
  Wallet,
  TrendingUp,
  Receipt,
  ClipboardList,
  Landmark,
  Target,
  Sparkles,
  Clock,
  Check,
  ArrowUpRight,
} from 'lucide-react'

import type { Expense } from '@/lib/types'
import type { AllocationDatum } from '@/components/allocation-breakdown'
import {
  PageHeader,
  Money,
  CountText,
  Reveal,
  Ring,
  Donut,
  AreaChart,
  ProgressBar,
  GaugeArc,
  Pill,
  CatDot,
  fmtMoney,
  fmtDate,
} from '@/components/redesign'

export type VaultGrowthPoint = {
  label: string
  value: number
  received: boolean
}

export interface DashboardTilesProps {
  todayLabel: string
  deadlineLabel: string
  vaultCap: number
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
  vaultGrowth: VaultGrowthPoint[]
  coGauge: { spent: number; allowed: number }
}

// Bucket / category hue palette - mirrors the design handoff palette so the
// donut, dots, and area fills share a single source of truth.
const BUCKET_HUE: Record<string, number> = {
  Vault: 285,
  Rent: 35,
  Robinhood: 150,
  CO: 220,
  Buffer: 330,
}

const CATEGORY_HUE: Record<string, number> = {
  Food: 35,
  Transit: 220,
  Entertainment: 285,
  Groceries: 150,
  Other: 250,
}

const EMPLOYER_HUE: Record<string, number> = {
  'USC On-Campus': 235,
  'Colorado Internship': 150,
}

export function DashboardTiles(props: DashboardTilesProps) {
  const {
    todayLabel,
    deadlineLabel,
    vault,
    weekBudget,
    nextPaycheck,
    projected,
    paycheckStatus,
    recentExpenses,
    allocation,
    accountsPreview,
    vaultGrowth,
    coGauge,
  } = props

  const vaultPctFrac = Math.min(1, vault.percent / 100)
  const coPct = coGauge.allowed > 0 ? coGauge.spent / coGauge.allowed : 0
  const coPctClamped = Math.max(0, Math.min(1, coPct))

  return (
    <div>
      <PageHeader
        title="Summer at a glance"
        subtitle={`${todayLabel} · saving toward ${fmtMoney(vault.projected)} by ${deadlineLabel}`}
      />

      <div
        className="bento-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <Reveal style={{ gridColumn: 'span 2' }}>
          <TileLink href="/accounts">
            <VaultProgressTile
              percent={vaultPctFrac}
              current={vault.current}
              projected={vault.projected}
              cap={vault.cap}
              remaining={vault.remaining}
              deadlineLabel={deadlineLabel}
            />
          </TileLink>
        </Reveal>

        <Reveal delay={60}>
          <TileLink href="/expenses">
            <CoBudgetTile
              leftNow={Math.max(0, coGauge.allowed - coGauge.spent)}
              spent={coGauge.spent}
              allowed={coGauge.allowed}
              weekRangeLabel={`${weekBudget.weekStartLabel} – ${weekBudget.weekEndLabel}`}
              isUnder={weekBudget.isUnder}
              variance={weekBudget.variance}
            />
          </TileLink>
        </Reveal>

        <Reveal delay={100} style={{ gridColumn: 'span 2' }}>
          <TileLink href="/weekly">
            <VaultGrowthTile points={vaultGrowth} cap={vault.cap} />
          </TileLink>
        </Reveal>

        <Reveal delay={140}>
          <TileLink href="/expenses">
            <CoGaugeTile pct={coPctClamped} spent={coGauge.spent} allowed={coGauge.allowed} />
          </TileLink>
        </Reveal>

        <Reveal delay={180}>
          <TileLink href="/paychecks">
            <NextPaycheckTile next={nextPaycheck} />
          </TileLink>
        </Reveal>

        <Reveal delay={220}>
          <TileLink href="/paychecks">
            <ProjectedSummerTile projected={projected} />
          </TileLink>
        </Reveal>

        <Reveal delay={260}>
          <TileLink href="/paychecks">
            <PaycheckStatusTile status={paycheckStatus} />
          </TileLink>
        </Reveal>

        <Reveal delay={300}>
          <TileLink href="/accounts">
            <AccountsLiveTile accounts={accountsPreview} />
          </TileLink>
        </Reveal>

        <Reveal delay={340}>
          <TileLink href="/expenses">
            <RecentExpensesTile expenses={recentExpenses} />
          </TileLink>
        </Reveal>

        <Reveal delay={380}>
          <TileLink href="/paychecks">
            <AllocationBreakdownTile data={allocation} />
          </TileLink>
        </Reveal>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .bento-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .bento-grid > div[style*="grid-column: span 2"] { grid-column: span 2 !important; }
        }
        @media (max-width: 640px) {
          .bento-grid { grid-template-columns: 1fr !important; }
          .bento-grid > div[style*="grid-column: span 2"] { grid-column: auto !important; }
        }
      `}</style>
    </div>
  )
}

/* ---------------- Shared shell pieces ---------------- */

function TileLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      style={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}
    >
      {children}
    </Link>
  )
}

type CardHeadProps = {
  icon: React.ReactNode
  hue?: number
  title: string
  sub?: string
  right?: React.ReactNode
}

function CardHead({ icon, hue, title, sub, right }: CardHeadProps) {
  const color = hue != null ? `oklch(0.62 0.16 ${hue})` : 'var(--accent)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', gap: 11, minWidth: 0 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            background: `color-mix(in oklch, ${color} 16%, transparent)`,
            color,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: '600 15px/1.1 var(--ui)',
              color: 'var(--ink-1)',
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              style={{
                font: '500 12px/1.3 var(--ui)',
                color: 'var(--ink-3)',
                marginTop: 3,
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
      {right}
    </div>
  )
}

function KV({
  k,
  v,
  color,
}: {
  k: string
  v: React.ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ font: '500 13.5px var(--ui)', color: 'var(--ink-3)' }}>
        {k}
      </span>
      <span
        style={{
          font: '600 14.5px var(--display)',
          color: color || 'var(--ink-1)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {v}
      </span>
    </div>
  )
}

function tileCardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: 22,
    height: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--hair)',
    borderRadius: 'var(--radius)',
    position: 'relative',
    overflow: 'hidden',
    ...extra,
  }
}

/* ---------------- Individual tiles ---------------- */

function VaultProgressTile({
  percent,
  current,
  projected,
  cap,
  remaining,
  deadlineLabel,
}: {
  percent: number
  current: number
  projected: number
  cap: number
  remaining: number
  deadlineLabel: string
}) {
  return (
    <div className="fx-card" style={tileCardStyle({ padding: 24 })}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 130% at 100% 0%, color-mix(in oklch, var(--accent) 12%, transparent), transparent 55%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          gap: 28,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Ring
          value={percent}
          secondaryValue={1}
          size={172}
          stroke={17}
          track="var(--ring-track)"
          secondaryColor="color-mix(in oklch, var(--gold) 30%, transparent)"
          gradient={['var(--gold)', 'var(--accent)']}
          glow="color-mix(in oklch, var(--accent) 40%, transparent)"
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                font: '600 32px/1 var(--display)',
                letterSpacing: '-.03em',
                color: 'var(--ink-1)',
              }}
            >
              <CountText value={Math.round(percent * 100)} />%
            </div>
            <div
              style={{
                font: '600 10px/1 var(--ui)',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                marginTop: 5,
              }}
            >
              funded
            </div>
          </div>
        </Ring>
        <div style={{ flex: 1, minWidth: 240 }}>
          <CardHead
            icon={<Target size={17} />}
            title="Vault Progress"
            sub={`Projected ${fmtMoney(projected)} by ${deadlineLabel}`}
            right={
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--ink-3)',
                }}
              >
                <ArrowUpRight size={16} />
              </span>
            }
          />
          <div
            style={{
              font: '600 clamp(34px,4vw,46px)/1 var(--display)',
              letterSpacing: '-.03em',
              color: 'var(--ink-1)',
              margin: '4px 0 8px',
            }}
          >
            <Money value={current} cents dur={1500} />
          </div>
          <div
            style={{
              font: '500 14px var(--ui)',
              color: 'var(--ink-2)',
              marginBottom: 14,
            }}
          >
            Saving toward {fmtMoney(cap)} · {(percent * 100).toFixed(1)}% of the way
          </div>
          <ProgressBar pct={percent} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 9,
              font: '500 12.5px var(--ui)',
              color: 'var(--ink-3)',
            }}
          >
            <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
              {(percent * 100).toFixed(1)}% funded
            </span>
            <span>
              {fmtMoney(remaining)} to {fmtMoney(cap)} cap
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function CoBudgetTile({
  leftNow,
  spent,
  allowed,
  weekRangeLabel,
  isUnder,
  variance,
}: {
  leftNow: number
  spent: number
  allowed: number
  weekRangeLabel: string
  isUnder: boolean
  variance: number
}) {
  const pct = allowed > 0 ? Math.min(1, spent / allowed) : 0
  const tone = isUnder ? 'var(--pos-ink)' : 'var(--accent-ink)'
  const headline = isUnder ? leftNow : Math.abs(variance)
  return (
    <div
      className="fx-card"
      style={tileCardStyle({ borderLeft: '4px solid var(--pos)' })}
    >
      <CardHead
        icon={<Calendar size={17} />}
        hue={152}
        title="CO Budget"
        sub={weekRangeLabel}
      />
      <div
        style={{
          font: '600 clamp(30px,3.6vw,40px)/1 var(--display)',
          letterSpacing: '-.02em',
          color: tone,
          margin: '6px 0 6px',
        }}
      >
        <Money value={headline} cents dur={1200} />
      </div>
      <div
        style={{
          font: '500 14px var(--ui)',
          color: 'var(--ink-2)',
          marginBottom: 16,
        }}
      >
        {isUnder ? 'left to spend overall' : 'over budget overall'}
      </div>
      <ProgressBar pct={pct} color="var(--pos)" />
      <div
        style={{
          font: '500 12.5px var(--ui)',
          color: 'var(--ink-3)',
          marginTop: 10,
        }}
      >
        Spent {fmtMoney(spent, { cents: true })} · Maximum allowed{' '}
        {fmtMoney(allowed, { cents: true })}
      </div>
    </div>
  )
}

function VaultGrowthTile({
  points,
  cap,
}: {
  points: VaultGrowthPoint[]
  cap: number
}) {
  const series = [
    {
      name: 'Vault',
      color: 'var(--accent)',
      fill: true,
      points: points.map((p) => ({ x: p.label, y: p.value })),
    },
  ]
  return (
    <div className="fx-card" style={tileCardStyle()}>
      <CardHead
        icon={<TrendingUp size={17} />}
        hue={285}
        title="Vault growth"
        sub={`Cumulative climb to ${fmtMoney(cap)}`}
      />
      {points.length > 0 ? (
        <AreaChart
          series={series}
          width={680}
          height={200}
          splitAt={(() => {
            const lastReceived = points
              .map((p, i) => ({ i, received: p.received }))
              .filter((p) => p.received)
              .pop()
            return lastReceived ? lastReceived.i : -1
          })()}
          tooltipContent={(x, pts) => {
            const v = pts[0]?.value ?? 0
            const pct = cap > 0 ? Math.min(100, (v / cap) * 100) : 0
            return (
              <div style={{ minWidth: 160 }}>
                <div
                  style={{
                    font: '600 12.5px var(--ui)',
                    color: 'var(--ink-1)',
                    marginBottom: 6,
                  }}
                >
                  Through {String(x)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    font: '500 12px var(--ui)',
                    color: 'var(--ink-3)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: 'var(--accent)',
                      }}
                    />
                    Vault
                  </span>
                  <span
                    style={{
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtMoney(v, { cents: true })}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    font: '500 11px var(--ui)',
                    color: 'var(--ink-3)',
                  }}
                >
                  {pct.toFixed(1)}% of {fmtMoney(cap)} cap
                </div>
              </div>
            )
          }}
        />
      ) : (
        <EmptyHint title="No paychecks yet" body="Add paychecks to track vault growth." />
      )}
    </div>
  )
}

function CoGaugeTile({
  pct,
  spent,
  allowed,
}: {
  pct: number
  spent: number
  allowed: number
}) {
  return (
    <div
      className="fx-card"
      style={tileCardStyle({ display: 'flex', flexDirection: 'column' })}
    >
      <CardHead
        icon={<Calendar size={17} />}
        hue={152}
        title="CO budget used"
        sub="Spent vs allowed"
      />
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          paddingBottom: 8,
        }}
      >
        <GaugeArc
          value={pct}
          size={210}
          stroke={18}
          gradient={['var(--pos)', 'var(--accent)']}
          glow="color-mix(in oklch, var(--pos) 40%, transparent)"
        >
          <div style={{ textAlign: 'center', paddingBottom: 4 }}>
            <div
              style={{
                font: '600 30px var(--display)',
                letterSpacing: '-.02em',
                color: 'var(--ink-1)',
              }}
            >
              <CountText value={Math.round(pct * 100)} />%
            </div>
            <div
              style={{
                font: '500 12px var(--ui)',
                color: 'var(--ink-3)',
              }}
            >
              {fmtMoney(spent)} of {fmtMoney(allowed)}
            </div>
          </div>
        </GaugeArc>
      </div>
    </div>
  )
}

function NextPaycheckTile({
  next,
}: {
  next: DashboardTilesProps['nextPaycheck']
}) {
  if (!next) {
    return (
      <div className="fx-card" style={tileCardStyle({ padding: 20 })}>
        <CardHead
          icon={<Wallet size={17} />}
          title="Next Paycheck"
          sub="No paychecks scheduled"
        />
        <EmptyHint
          title="No paychecks yet"
          body="Add a paycheck on the Paychecks page."
        />
      </div>
    )
  }
  const hue = EMPLOYER_HUE[next.employer] ?? 235
  const isUSC = next.employer === 'USC On-Campus'
  const employerShort = isUSC ? 'USC' : 'NTT'
  return (
    <div className="fx-card" style={tileCardStyle({ padding: 20 })}>
      <CardHead
        icon={<Wallet size={17} />}
        title="Next Paycheck"
        sub={next.payDateLabel}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <span
          style={{
            font: '600 12px var(--ui)',
            padding: '4px 10px',
            borderRadius: 8,
            background: `color-mix(in oklch, oklch(0.62 0.16 ${hue}) 16%, transparent)`,
            color: `oklch(0.5 0.16 ${hue})`,
          }}
        >
          {employerShort}
        </span>
        {next.status === 'Pending' ? (
          <Pill tone="upcoming">
            <Clock size={12} /> Pending
          </Pill>
        ) : (
          <Pill tone="received">
            <Check size={12} /> Received
          </Pill>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <KV k="Projected net" v={<Money value={next.projectedNet} cents />} />
        <KV
          k="Vault"
          v={<Money value={next.vault} cents />}
          color="var(--accent-ink)"
        />
        <KV k="CO spend" v={<Money value={next.co} cents />} />
      </div>
    </div>
  )
}

function ProjectedSummerTile({
  projected,
}: {
  projected: DashboardTilesProps['projected']
}) {
  const items = [
    { label: 'Vault', value: projected.totalVault, hue: BUCKET_HUE.Vault },
    { label: 'CO', value: projected.totalCO, hue: BUCKET_HUE.CO },
    { label: 'Buffer', value: projected.totalBuffer, hue: BUCKET_HUE.Buffer },
    { label: 'Rent paid', value: projected.totalRentPaid, hue: BUCKET_HUE.Rent },
  ]
  return (
    <div className="fx-card" style={tileCardStyle({ padding: 20 })}>
      <CardHead
        icon={<TrendingUp size={17} />}
        hue={152}
        title="Projected (end of summer)"
        sub="Projected allocations across summer"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        {items.map((it) => (
          <div key={it.label}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
              }}
            >
              <CatDot hue={it.hue} size={8} />
              <span
                style={{
                  font: '500 12px var(--ui)',
                  color: 'var(--ink-3)',
                }}
              >
                {it.label}
              </span>
            </div>
            <div
              style={{
                font: '600 19px var(--display)',
                letterSpacing: '-.01em',
                color: 'var(--ink-1)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Money value={it.value} cents />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaycheckStatusTile({
  status,
}: {
  status: DashboardTilesProps['paycheckStatus']
}) {
  const total = Math.max(status.total, 1)
  return (
    <div
      className="fx-card"
      style={tileCardStyle({
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <CardHead
        icon={<ClipboardList size={17} />}
        title="Paycheck Status"
        sub={`${status.pending} pending of ${status.total} total`}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          margin: '2px 0 14px',
        }}
      >
        <span
          style={{
            font: '600 40px/1 var(--display)',
            letterSpacing: '-.02em',
            color: 'var(--ink-1)',
          }}
        >
          <CountText value={status.pending} />
        </span>
        <span
          style={{ font: '500 15px var(--ui)', color: 'var(--ink-3)' }}
        >
          pending
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: i < status.received ? 'var(--mint)' : 'var(--hair)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Pill tone="received">
          <Check size={12} /> {status.received} received
        </Pill>
        <Pill tone="upcoming">
          <Clock size={12} /> {status.pending} pending
        </Pill>
      </div>
    </div>
  )
}

function AccountsLiveTile({
  accounts,
}: {
  accounts: DashboardTilesProps['accountsPreview']
}) {
  return (
    <div
      className="fx-card"
      style={tileCardStyle({
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <CardHead
        icon={<Landmark size={17} />}
        title="Accounts"
        sub="Live balances right now"
        right={
          <span
            style={{
              font: '600 12px var(--ui)',
              color: 'var(--ink-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            All <ArrowUpRight size={13} />
          </span>
        }
      />
      {accounts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {accounts.map((a, i) => {
            const isCC = a.type === 'credit_card'
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 2px',
                  borderTop: i ? '1px solid var(--hair)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: '600 13.5px var(--ui)',
                      color: 'var(--ink-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      font: '500 11px var(--ui)',
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-4)',
                    }}
                  >
                    {accountTypeLabel(a.type)}
                  </div>
                </div>
                <div
                  style={{
                    font: '600 14.5px var(--display)',
                    fontVariantNumeric: 'tabular-nums',
                    color:
                      isCC && a.current_balance > 0
                        ? 'var(--accent-ink)'
                        : 'var(--ink-1)',
                  }}
                >
                  {isCC && a.current_balance > 0 ? '−' : ''}
                  <Money
                    value={Math.abs(a.current_balance)}
                    cents
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyHint
          title="No accounts yet"
          body="Seed accounts in the database to see balances here."
        />
      )}
    </div>
  )
}

function RecentExpensesTile({ expenses }: { expenses: Expense[] }) {
  return (
    <div
      className="fx-card"
      style={tileCardStyle({
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <CardHead
        icon={<Receipt size={17} />}
        hue={345}
        title="Recent Expenses"
        sub={
          expenses.length > 0
            ? `Last ${expenses.length} entries`
            : 'Nothing logged yet'
        }
        right={
          <span
            style={{
              font: '600 12px var(--ui)',
              color: 'var(--ink-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            All <ArrowUpRight size={13} />
          </span>
        }
      />
      {expenses.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {expenses.map((e, i) => {
            const hue = CATEGORY_HUE[e.category] ?? 250
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 2px',
                  borderTop: i ? '1px solid var(--hair)' : 'none',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    background: `color-mix(in oklch, oklch(0.68 0.14 ${hue}) 16%, transparent)`,
                    color: `oklch(0.54 0.14 ${hue})`,
                  }}
                >
                  <CatDot hue={hue} size={8} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: '600 13.5px var(--ui)',
                      color: 'var(--ink-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {e.description}
                  </div>
                  <div
                    style={{
                      font: '500 11.5px var(--ui)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {fmtDate(e.expense_date, 'short')}
                  </div>
                </div>
                <div
                  style={{
                    font: '600 14px var(--display)',
                    color: 'var(--ink-1)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Money value={e.amount} cents />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyHint
          title="No expenses yet"
          body="Log spend on the Expenses page to see it here."
        />
      )}
    </div>
  )
}

function AllocationBreakdownTile({ data }: { data: AllocationDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const donutData = data.map((d) => ({
    label: d.name,
    total: d.value,
    hue: BUCKET_HUE[d.name] ?? 250,
  }))
  return (
    <div className="fx-card" style={tileCardStyle({ padding: 20 })}>
      <CardHead
        icon={<Target size={17} />}
        hue={285}
        title="Allocation Breakdown"
        sub="Allocated so far, by bucket"
      />
      {total > 0 ? (
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Donut
            data={donutData}
            size={130}
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
              minWidth: 130,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {donutData.map((b) => (
              <div
                key={b.label}
                style={{ display: 'flex', alignItems: 'center', gap: 9 }}
              >
                <CatDot hue={b.hue} />
                <span
                  style={{
                    flex: 1,
                    font: '500 13px var(--ui)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {b.label}
                </span>
                <span
                  style={{
                    font: '600 13px var(--display)',
                    color: 'var(--ink-1)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round((b.total / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyHint
          title="Nothing allocated yet"
          body="Mark a paycheck received to see allocation."
        />
      )}
    </div>
  )
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '24px 8px',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
          marginBottom: 4,
        }}
      >
        <Sparkles size={18} />
      </span>
      <div style={{ font: '600 13px var(--ui)', color: 'var(--ink-1)' }}>
        {title}
      </div>
      <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>
        {body}
      </div>
    </div>
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

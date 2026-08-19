import Link from 'next/link'
import { HandCoins, ArrowRight } from 'lucide-react'
import { fmtMoney } from '@/components/redesign'

export interface LenderDebtRow {
  id: string
  name: string
  principal: number
  outstanding: number
}

export function LenderDebtsCard({ rows }: { rows: LenderDebtRow[] }) {
  const withOutstanding = rows.filter((r) => r.outstanding > 0.005)
  if (withOutstanding.length === 0) return null

  const totalOwed = withOutstanding.reduce((s, r) => s + r.outstanding, 0)
  const totalBorrowed = withOutstanding.reduce((s, r) => s + r.principal, 0)
  const paidBack = Math.max(0, totalBorrowed - totalOwed)
  const paidPct =
    totalBorrowed > 0 ? Math.min(100, (paidBack / totalBorrowed) * 100) : 0

  return (
    <section
      style={{
        marginBottom: 20,
        padding: '18px 20px',
        borderRadius: 16,
        background:
          'linear-gradient(135deg, rgba(245, 198, 107, 0.06), rgba(138, 111, 224, 0.05))',
        border: '1px solid rgba(245, 198, 107, 0.28)',
      }}
      aria-label="Money owed to lenders"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background:
              'linear-gradient(135deg, #f5c66b, #d4a14a 55%, #8a6fe0)',
            color: '#1a1812',
            flexShrink: 0,
          }}
        >
          <HandCoins size={18} strokeWidth={2.4} />
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div
            style={{
              font: '600 11px/1 var(--ui)',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              marginBottom: 6,
            }}
          >
            Money owed
          </div>
          <div
            style={{
              font: '700 22px/1.1 var(--display)',
              color: 'var(--ink-1)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtMoney(totalOwed)}{' '}
            <span
              style={{
                font: '500 12.5px/1 var(--ui)',
                color: 'var(--ink-3)',
                marginLeft: 4,
              }}
            >
              of {fmtMoney(totalBorrowed)} borrowed
            </span>
          </div>
        </div>
        <Link
          href="/settings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--hair)',
            font: '600 12px var(--ui)',
            color: 'var(--ink-2)',
            textDecoration: 'none',
            background: 'var(--surface)',
          }}
        >
          Manage
          <ArrowRight size={12} strokeWidth={2.4} />
        </Link>
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gap: 8,
        }}
      >
        {withOutstanding.map((r) => {
          const pct =
            r.principal > 0
              ? Math.min(100, ((r.principal - r.outstanding) / r.principal) * 100)
              : 0
          return (
            <div key={r.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  font: '500 12.5px/1.4 var(--ui)',
                  color: 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span>
                  {fmtMoney(r.outstanding)} owed
                  <span
                    style={{ color: 'var(--ink-3)', fontWeight: 500 }}
                  >
                    {' '}
                    · {fmtMoney(r.principal)} borrowed
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--hair)',
                  overflow: 'hidden',
                }}
                aria-hidden
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background:
                      'linear-gradient(90deg, #f5c66b, #d4a14a 55%, #8a6fe0)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {paidPct > 0 && (
        <div
          style={{
            marginTop: 12,
            font: '500 11.5px/1.4 var(--ui)',
            color: 'var(--ink-3)',
          }}
        >
          {Math.round(paidPct)}% paid back so far. The vault goal will not
          complete until every lender is squared up.
        </div>
      )}
    </section>
  )
}

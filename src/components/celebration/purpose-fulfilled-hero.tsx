'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sigma, Sparkles, Trophy } from 'lucide-react'
import { useGoalStatus } from './celebration-context'
import { fmtMoney } from '@/components/redesign'

export function PurposeFulfilledHero() {
  const status = useGoalStatus()
  if (!status?.isRetired) return null

  const endDate = new Date(
    status.internshipEndISO + 'T12:00:00',
  ).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'relative',
        marginBottom: 24,
        padding: '36px 28px 30px',
        borderRadius: 22,
        background:
          'linear-gradient(160deg, #1a1812 0%, #2a2418 55%, #1a1812 100%)',
        border: '1px solid rgba(245, 198, 107, 0.35)',
        boxShadow:
          '0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(245, 198, 107, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        color: '#faf4e6',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 22,
          padding: 1,
          background:
            'conic-gradient(from 0deg at 50% 50%, #f5c66b, #8a6fe0, #f5c66b, #d4a14a, #f5c66b)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: 'purpose-spin 8s linear infinite',
          opacity: 0.45,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 64,
            height: 64,
            borderRadius: 18,
            display: 'grid',
            placeItems: 'center',
            background:
              'linear-gradient(135deg, #f5c66b, #d4a14a 55%, #8a6fe0)',
            boxShadow:
              '0 12px 30px rgba(212, 161, 74, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
          }}
        >
          <Trophy size={28} color="#1a1812" strokeWidth={2.4} />
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              fontSize: 11,
              color: '#f5c66b',
              fontWeight: 600,
            }}
          >
            <Sparkles
              size={12}
              style={{ display: 'inline', verticalAlign: -1, marginRight: 6 }}
            />
            Mission Accomplished
          </div>
          <h2
            style={{
              margin: '10px 0 6px',
              font: '700 clamp(24px, 3.4vw, 32px)/1.15 var(--font-display, var(--display))',
              letterSpacing: '-0.02em',
              color: 'transparent',
              backgroundImage:
                'linear-gradient(180deg, #ffffff 0%, #f5c66b 60%, #d4a14a 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            Summer 2026 is in the books
          </h2>
          <p
            style={{
              margin: 0,
              font: '500 15px/1.55 var(--font-ui, var(--ui))',
              color: 'rgba(250, 244, 230, 0.78)',
            }}
          >
            You saved {fmtMoney(Math.max(status.current, status.cap))} across{' '}
            {status.paycheckContributions} paycheck
            {status.paycheckContributions === 1 ? '' : 's'} and closed out the
            summer on {endDate}. This app has served its purpose. Thanks for the
            ride.
          </p>

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/summary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                background:
                  'linear-gradient(135deg, #f5c66b, #d4a14a 45%, #b6832f)',
                color: '#1a1812',
                font: '700 13px var(--font-ui, var(--ui))',
                letterSpacing: '0.02em',
                textDecoration: 'none',
                boxShadow: '0 10px 24px rgba(212, 161, 74, 0.35)',
              }}
            >
              <Sigma size={14} strokeWidth={2.6} />
              View the summer summary
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes purpose-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.section>
  )
}

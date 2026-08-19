'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Trophy, X } from 'lucide-react'
import { grandCelebration } from './confetti'
import { fmtMoney } from '@/components/redesign'

type Props = {
  open: boolean
  cap: number
  current: number
  paycheckContributions: number
  daysUntilDeadline: number
  deadlineISO: string
  onClose: () => void
  /** True when triggered manually via the "Replay" button in settings.
   *  Skips the persistence side-effect so the caller can decide it. */
  replay?: boolean
}

function useAnimatedNumber(target: number, active: boolean, ms = 1800) {
  const [n, setN] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (!active) {
      setN(0)
      start.current = null
      return
    }
    let raf = 0
    const step = (t: number) => {
      if (start.current == null) start.current = t
      const elapsed = t - start.current
      const p = Math.min(1, elapsed / ms)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setN(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, target, ms])
  return n
}

export function GoalReachedModal(props: Props) {
  const {
    open,
    cap,
    paycheckContributions,
    daysUntilDeadline,
    deadlineISO,
    onClose,
  } = props
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    grandCelebration()
    const t = window.setTimeout(() => grandCelebration(), 2400)
    return () => window.clearTimeout(t)
  }, [open])

  const displayed = useAnimatedNumber(cap, open)
  const deadline = useMemo(
    () =>
      new Date(deadlineISO + 'T12:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [deadlineISO],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="celebration-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background:
              'radial-gradient(ellipse at 50% 40%, rgba(20, 16, 8, 0.55), rgba(0, 0, 0, 0.82) 70%)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            key="celebration-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            style={{
              position: 'relative',
              width: 'min(560px, 100%)',
              padding: '36px 32px 28px',
              borderRadius: 24,
              background:
                'linear-gradient(160deg, #1a1812 0%, #2a2418 55%, #1a1812 100%)',
              border: '1px solid rgba(245, 198, 107, 0.35)',
              boxShadow:
                '0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(245, 198, 107, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              color: '#faf4e6',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: -1,
                borderRadius: 24,
                padding: 1,
                background:
                  'conic-gradient(from 0deg at 50% 50%, #f5c66b, #8a6fe0, #f5c66b, #d4a14a, #f5c66b)',
                WebkitMask:
                  'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: 'celebration-spin 6s linear infinite',
                opacity: 0.55,
                pointerEvents: 'none',
              }}
            />
            <button
              onClick={onClose}
              aria-label="Close celebration"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#faf4e6',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>

            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                stiffness: 220,
                damping: 14,
                delay: 0.15,
              }}
              style={{
                width: 72,
                height: 72,
                margin: '0 auto 18px',
                borderRadius: 20,
                display: 'grid',
                placeItems: 'center',
                background:
                  'linear-gradient(135deg, #f5c66b, #d4a14a 55%, #8a6fe0)',
                boxShadow:
                  '0 12px 30px rgba(212, 161, 74, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
              }}
            >
              <Trophy size={32} color="#1a1812" strokeWidth={2.4} />
            </motion.div>

            <div
              style={{
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.24em',
                fontSize: 11,
                color: '#f5c66b',
                fontWeight: 600,
              }}
            >
              <Sparkles
                size={12}
                style={{ display: 'inline', verticalAlign: -1, marginRight: 6 }}
              />
              Tuition. Handled.
              <Sparkles
                size={12}
                style={{ display: 'inline', verticalAlign: -1, marginLeft: 6 }}
              />
            </div>

            <div
              style={{
                marginTop: 14,
                textAlign: 'center',
                font: '800 clamp(48px, 8vw, 72px)/1 var(--font-display, var(--display))',
                letterSpacing: '-0.03em',
                color: 'transparent',
                backgroundImage:
                  'linear-gradient(180deg, #ffffff 0%, #f5c66b 55%, #d4a14a 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                textShadow: '0 4px 30px rgba(245, 198, 107, 0.25)',
              }}
            >
              {fmtMoney(displayed)}
            </div>

            <div
              style={{
                marginTop: 10,
                textAlign: 'center',
                font: '500 15px var(--font-ui, var(--ui))',
                color: 'rgba(250, 244, 230, 0.85)',
                lineHeight: 1.55,
              }}
            >
              Dear USC, please find {fmtMoney(cap)} attached.
              <br />
              <span style={{ color: 'rgba(250, 244, 230, 0.6)' }}>
                Earned in USD. Paid in USD. No loan officer, no cosigner, no
                calls home.
              </span>
              <br />
              <span
                style={{
                  color: 'rgba(250, 244, 230, 0.55)',
                  fontSize: 13,
                }}
              >
                Fall 2026 tuition, sorted by {deadline}
                {daysUntilDeadline > 0 && (
                  <>
                    .{' '}
                    <span style={{ color: '#f5c66b', fontWeight: 600 }}>
                      {daysUntilDeadline} day{daysUntilDeadline === 1 ? '' : 's'}{' '}
                      early because why not
                    </span>
                  </>
                )}
                .
              </span>
            </div>

            <div
              style={{
                marginTop: 22,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <Stat
                label="Checks cashed"
                value={String(paycheckContributions)}
              />
              <Stat label="Loans taken" value="$0" />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{
                marginTop: 24,
                width: '100%',
                padding: '14px 18px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                background:
                  'linear-gradient(135deg, #f5c66b, #d4a14a 45%, #b6832f)',
                color: '#1a1812',
                font: '700 15px var(--font-ui, var(--ui))',
                letterSpacing: '0.02em',
                boxShadow: '0 10px 30px rgba(212, 161, 74, 0.4)',
              }}
            >
              OK, enough flexing
            </motion.button>
          </motion.div>
          <style>{`
            @keyframes celebration-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontSize: 10,
          color: 'rgba(250, 244, 230, 0.55)',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          font: '700 20px var(--font-display, var(--display))',
          color: '#faf4e6',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

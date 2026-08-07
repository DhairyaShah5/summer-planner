'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useGoalStatus } from './celebration-context'
import { useCelebrationMode } from './use-celebrations'
import { burstFromElement } from './confetti'
import { useCallback, useRef } from 'react'

export function GoalBadge() {
  const status = useGoalStatus()
  const [mode] = useCelebrationMode()
  const ref = useRef<HTMLButtonElement | null>(null)
  const onClick = useCallback(() => {
    burstFromElement(ref.current)
  }, [])

  if (!status?.isReached) return null
  if (mode === 'off') return null

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      aria-label="Goal reached — click for a small burst"
      className="celebration-goal-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px 5px 8px',
        borderRadius: 999,
        border: '1px solid rgba(212, 161, 74, 0.6)',
        background:
          'linear-gradient(135deg, rgba(245, 198, 107, 0.24), rgba(138, 111, 224, 0.18))',
        color: 'var(--ink-1, #1a1812)',
        font: '600 12px var(--font-ui, var(--ui))',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(212, 161, 74, 0.2)',
      }}
    >
      <Sparkles size={12} color="#d4a14a" />
      <span>Goal reached</span>
      <style>{`
        .celebration-goal-badge {
          position: relative;
          overflow: hidden;
        }
        .celebration-goal-badge::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 40%,
            rgba(255, 255, 255, 0.55) 50%,
            transparent 60%
          );
          transform: translateX(-100%);
          animation: goalBadgeShimmer 3.6s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes goalBadgeShimmer {
          0%   { transform: translateX(-100%); }
          55%  { transform: translateX(160%); }
          100% { transform: translateX(160%); }
        }
      `}</style>
    </motion.button>
  )
}

'use client'

import { motion } from 'framer-motion'
import { PartyPopper, Sparkles, MinusCircle } from 'lucide-react'
import { useGoalStatus } from './celebration-context'
import {
  resetAmbient,
  useCelebrationMode,
  useRevealSeen,
  type CelebrationMode,
} from './use-celebrations'
import { grandCelebration, previewBurst } from './confetti'

const OPTIONS: Array<{
  value: CelebrationMode
  label: string
  hint: string
  icon: React.ComponentType<{ size?: number }>
}> = [
  {
    value: 'full',
    label: 'Full',
    hint: 'Modal + badge + ambient bursts',
    icon: PartyPopper,
  },
  {
    value: 'badge',
    label: 'Badge only',
    hint: 'Gold pill in the nav, no confetti',
    icon: Sparkles,
  },
  {
    value: 'off',
    label: 'Off',
    hint: 'Silence everything',
    icon: MinusCircle,
  },
]

export function CelebrationsToggle() {
  const [mode, setMode] = useCelebrationMode()
  const [, { reset }] = useRevealSeen()
  const status = useGoalStatus()

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              font: '600 11.5px var(--ui)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Celebrations
          </div>
          <div
            style={{
              marginTop: 4,
              font: '500 13px var(--ui)',
              color: 'var(--ink-2)',
              maxWidth: 460,
            }}
          >
            {status?.isReached
              ? 'Goal reached — the site is glowing. Choose how loud you want it.'
              : `Fires when Vault ≥ ${status?.cap ? '$' + status.cap.toLocaleString() : 'goal'}. Preview any time below.`}
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => previewBurst()}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--hair)',
            background: 'var(--surface-2)',
            font: '600 12px var(--ui)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          Preview
        </motion.button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {OPTIONS.map((opt) => {
          const active = mode === opt.value
          const Icon = opt.icon
          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              whileTap={{ scale: 0.97 }}
              style={{
                textAlign: 'left',
                padding: '12px 13px',
                borderRadius: 12,
                cursor: 'pointer',
                background: active
                  ? 'color-mix(in oklch, var(--accent) 12%, var(--surface-2))'
                  : 'var(--surface-2)',
                border: active
                  ? '1px solid color-mix(in oklch, var(--accent) 50%, transparent)'
                  : '1px solid var(--hair)',
                boxShadow: active
                  ? '0 6px 20px color-mix(in oklch, var(--accent) 18%, transparent)'
                  : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                color: 'var(--ink-1)',
              }}
              aria-pressed={active}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  font: '600 13px var(--ui)',
                }}
              >
                <Icon size={14} />
                {opt.label}
              </span>
              <span
                style={{
                  font: '500 12px var(--ui)',
                  color: 'var(--ink-3)',
                }}
              >
                {opt.hint}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            reset()
            resetAmbient()
            grandCelebration()
          }}
          disabled={!status?.isReached}
          style={{
            padding: '10px 14px',
            borderRadius: 11,
            border: 'none',
            cursor: status?.isReached ? 'pointer' : 'not-allowed',
            background: status?.isReached
              ? 'linear-gradient(135deg, var(--gold), color-mix(in oklch, var(--gold) 70%, var(--accent)))'
              : 'var(--surface-2)',
            color: status?.isReached ? '#1a1812' : 'var(--ink-3)',
            font: '700 12.5px var(--ui)',
            letterSpacing: '.02em',
            opacity: status?.isReached ? 1 : 0.55,
          }}
          title={
            status?.isReached
              ? 'Replay the goal-reached moment'
              : "Available once you've hit your Vault goal"
          }
        >
          Replay celebration
        </motion.button>
      </div>
    </div>
  )
}

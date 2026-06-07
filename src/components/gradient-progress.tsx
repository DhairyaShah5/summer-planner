'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * A smooth red → amber → green gradient progress bar.
 *
 * Implementation detail: the gradient itself is rendered at full width
 * (red on the left, amber in the middle, green on the right). A second
 * layer animates its width from 0 → `percent`% to reveal more of the
 * underlying gradient. This means the color at any horizontal position
 * is fixed - the fill just unveils more of it as `percent` grows.
 */
export function GradientProgress({
  percent,
  className,
  height = 'h-2.5',
}: {
  percent: number
  className?: string
  height?: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-muted',
        height,
        className,
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Full-width gradient sitting beneath the reveal mask. */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(to right, #ef4444 0%, #f59e0b 50%, #10b981 100%)',
        }}
      />
      {/* Cover that retracts to reveal the gradient up to `percent`%. */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 right-0 rounded-r-full bg-muted"
        initial={{ width: '100%' }}
        animate={{ width: `${100 - clamped}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

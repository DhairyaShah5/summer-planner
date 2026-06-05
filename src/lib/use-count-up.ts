'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animate a numeric value from its previous setting to `target` over
 * `durationMs`. Returns the current interpolated value. Useful for
 * dashboard key numbers that should "count up" on mount or when their
 * underlying total changes.
 *
 * Uses requestAnimationFrame and an ease-out cubic curve so the
 * animation feels punchy at the start and settles near the end.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState<number>(target === 0 ? 0 : 0)
  const fromRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (!Number.isFinite(to)) {
      setValue(0)
      return
    }
    if (from === to) {
      setValue(to)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / durationMs)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (to - from) * eased
      setValue(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      // Persist where we ended up so the next change interpolates
      // from the visible value, not from 0.
      fromRef.current = to
    }
  }, [target, durationMs])

  return value
}

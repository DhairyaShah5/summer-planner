'use client'

import { useCountUp } from '@/lib/use-count-up'

/**
 * Display a number that animates from its previous value to `value` whenever
 * `value` changes. `format` controls how the live (interpolated) number is
 * rendered - typically `Intl.NumberFormat#format` for currency.
 */
export function AnimatedNumber({
  value,
  format,
  durationMs = 900,
  className,
}: {
  value: number
  format: (n: number) => string
  durationMs?: number
  className?: string
}) {
  const live = useCountUp(value, durationMs)
  return <span className={className}>{format(live)}</span>
}

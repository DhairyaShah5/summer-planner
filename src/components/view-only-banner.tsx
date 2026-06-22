import Link from 'next/link'
import { Eye } from 'lucide-react'

export function ViewOnlyBanner() {
  return (
    <div
      role="status"
      aria-label="View-only mode"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 16px',
        background:
          'color-mix(in oklch, var(--accent, oklch(0.7 0.18 250)) 14%, transparent)',
        borderBottom:
          '1px solid color-mix(in oklch, var(--accent, oklch(0.7 0.18 250)) 28%, transparent)',
        color: 'var(--ink-1, var(--foreground))',
        font: '500 12.5px var(--font-ui, var(--ui))',
        letterSpacing: '0.02em',
      }}
    >
      <Eye size={14} aria-hidden />
      <span>
        View only - this is a live, read-only copy.{' '}
        <Link
          href="/login"
          style={{
            color: 'var(--accent)',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          Sign in
        </Link>{' '}
        to make changes.
      </span>
    </div>
  )
}

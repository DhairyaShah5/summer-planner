import confetti from 'canvas-confetti'

const GOLD_PALETTE = ['#f5c66b', '#d4a14a', '#f0d585', '#c48a2f', '#f6e0a3']
const ACCENT_PALETTE = ['#8a6fe0', '#a58bf5', '#6b4fbf', '#c2b2ff', '#e5dcff']
const FULL_PALETTE = [...GOLD_PALETTE, ...ACCENT_PALETTE, '#ffffff']

// Party palette — deliberately loud and varied so the endless fall reads as
// festival confetti (gold, purple, pink, blue, green, orange, red, teal,
// yellow, white) rather than a monochrome sprinkle.
const PARTY_PALETTE = [
  '#f5c66b', '#d4a14a',   // gold
  '#8a6fe0', '#a58bf5',   // purple
  '#ff6b9d', '#ff85b3',   // pink
  '#4dabf7', '#74c0fc',   // blue
  '#51cf66', '#69db7c',   // green
  '#ff8c42', '#ffa94d',   // orange
  '#ff6b6b', '#ff8787',   // red
  '#20c997', '#38d9a9',   // teal
  '#ffd43b',              // yellow
  '#ffffff',              // white
]

export function ambientBurst() {
  confetti({
    particleCount: 40,
    spread: 62,
    startVelocity: 32,
    origin: { x: 0.5, y: 0.6 },
    colors: FULL_PALETTE,
    scalar: 0.9,
    disableForReducedMotion: true,
  })
}

export function burstFromElement(el: HTMLElement | null) {
  if (!el) {
    ambientBurst()
    return
  }
  const rect = el.getBoundingClientRect()
  const x = (rect.left + rect.width / 2) / window.innerWidth
  const y = (rect.top + rect.height / 2) / window.innerHeight
  confetti({
    particleCount: 55,
    spread: 78,
    startVelocity: 34,
    origin: { x, y },
    colors: FULL_PALETTE,
    scalar: 1,
    disableForReducedMotion: true,
  })
}

export async function grandCelebration() {
  const duration = 3600
  const end = performance.now() + duration
  const defaults = {
    startVelocity: 42,
    spread: 360,
    ticks: 90,
    zIndex: 9999,
    disableForReducedMotion: true,
    colors: FULL_PALETTE,
  }
  confetti({
    ...defaults,
    particleCount: 160,
    spread: 90,
    origin: { x: 0, y: 0.75 },
    angle: 60,
    scalar: 1.15,
  })
  confetti({
    ...defaults,
    particleCount: 160,
    spread: 90,
    origin: { x: 1, y: 0.75 },
    angle: 120,
    scalar: 1.15,
  })

  function frame() {
    const now = performance.now()
    const remaining = end - now
    if (remaining <= 0) return
    const particleCount = 6
    confetti({
      ...defaults,
      particleCount,
      origin: { x: Math.random() * 0.3, y: Math.random() * 0.35 + 0.15 },
      angle: 60,
      startVelocity: 50,
    })
    confetti({
      ...defaults,
      particleCount,
      origin: { x: 1 - Math.random() * 0.3, y: Math.random() * 0.35 + 0.15 },
      angle: 120,
      startVelocity: 50,
    })
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 220,
      spread: 140,
      origin: { x: 0.5, y: 0.2 },
      startVelocity: 55,
      scalar: 1.25,
    })
  }, 900)
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 260,
      spread: 160,
      origin: { x: 0.5, y: 0.25 },
      startVelocity: 60,
      scalar: 1.35,
    })
  }, 1900)
}

export function previewBurst() {
  confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 32,
    origin: { x: 0.5, y: 0.5 },
    colors: FULL_PALETTE,
    scalar: 1,
    disableForReducedMotion: true,
  })
}

/**
 * Ambient snowfall of confetti from the top of the viewport. Runs until the
 * returned stop() is invoked. Deliberately low density (~10 particles/sec)
 * so it reads as celebratory-but-not-distracting on every page.
 */
export function startEndlessFall(): () => void {
  if (typeof window === 'undefined') return () => {}
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return () => {}

  // Three staggered emitters covering left / center / right thirds of the
  // viewport so the sky above every part of the page is always seeding new
  // particles. Combined with a short interval this holds ~300-500 pieces
  // mid-fall — a real party, not a sprinkle.
  const emit = (xMin: number, xMax: number) => {
    confetti({
      particleCount: 8,
      startVelocity: 0,
      ticks: 500,
      gravity: 0.45,
      scalar: 1.05,
      spread: 120,
      angle: 270,
      drift: -0.6 + Math.random() * 1.2,
      origin: { x: xMin + Math.random() * (xMax - xMin), y: -0.05 },
      colors: PARTY_PALETTE,
      shapes: ['square', 'circle'],
      disableForReducedMotion: true,
    })
  }
  const id = window.setInterval(() => {
    if (document.hidden) return
    emit(0, 0.34)
    emit(0.33, 0.67)
    emit(0.66, 1)
  }, 90)
  return () => window.clearInterval(id)
}


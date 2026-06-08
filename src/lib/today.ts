/**
 * Returns "today" as a YYYY-MM-DD string in the user's local timezone.
 *
 * Server runtimes (Vercel functions) execute in UTC. For a personal app
 * pinned to a US user spending the summer in Colorado, we want the
 * planner's notion of "today" to follow the user's clock — otherwise the
 * Sunday 11pm local edit lands as Monday UTC and the "current week"
 * status flips a day early on every Sunday night.
 */
export const USER_TIMEZONE = 'America/Denver'

export function todayInUserTz(now: Date = new Date()): string {
  // en-CA happens to format as YYYY-MM-DD natively, so we sidestep manual
  // padding while letting Intl handle the timezone conversion.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: USER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Day-of-week (0 = Sunday … 6 = Saturday) for a date as observed in the
 *  user's timezone. Used to compute "this Monday" / "this Sunday" without
 *  the UTC drift bug. */
export function dayOfWeekInUserTz(now: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: USER_TIMEZONE,
    weekday: 'short',
  }).format(now)
  switch (weekday) {
    case 'Sun': return 0
    case 'Mon': return 1
    case 'Tue': return 2
    case 'Wed': return 3
    case 'Thu': return 4
    case 'Fri': return 5
    case 'Sat': return 6
    default: return 0
  }
}

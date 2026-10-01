/**
 * Kyiv day boundaries for promo date ranges.
 *
 * The admin form submits dates as YYYY-MM-DD (no time). Those must map to
 * 00:00:00 / 23:59:59 of that day in the Europe/Kyiv shop timezone — not UTC
 * midnight, which shifted promo windows by 2-3 hours (regression).
 *
 * Lives in lib/ (not in app/actions/*) on purpose: files under app/actions
 * are 'use server' modules where Next.js requires every export to be an
 * async Server Action. A sync date helper exported from there breaks the
 * production build.
 */
export const SHOP_TZ = 'Europe/Kyiv'

export function kyivDayBoundary(dateStr: string, endOfDay: boolean): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(guess))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return new Date(guess - (asUTC - guess))
}

'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { pluralize } from '@/lib/i18n/plural'

export type PromoTimerLocale = 'uk' | 'ru'

const DAY_WORDS: Record<PromoTimerLocale, [one: string, few: string, many: string]> = {
  uk: ['день', 'дні', 'днів'],
  ru: ['день', 'дня', 'дней'],
}

/**
 * Formats a remaining duration for the promo countdown. Under 24h it is
 * "HH:MM:SS"; from 24h up it splits off whole days, e.g. "2 дні 14:32:10"
 * (hours stay 00–23). The day word is pluralized for uk/ru (1 день,
 * 2 дні/дня, 5 днів/дней; 11–14 take the genitive plural).
 */
export function formatRemaining(ms: number, locale: PromoTimerLocale = 'uk'): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(h)}:${pad(m)}:${pad(s)}`
  if (days < 1) return time
  const [one, few, many] = DAY_WORDS[locale]
  return `${days} ${pluralize(days, one, few, many)} ${time}`
}

// Live "Акція діє ще: …" countdown for a product covered by a real,
// currently-active automatic promotion with a deadline (see
// getProductPromotionDeadline in lib/shop/queries.ts). The countdown starts
// only after mount: before that the same markup renders with a "--:--:--"
// placeholder, so the server render and the first client render match and
// there is no hydration flicker. Unmounts itself once the deadline passes
// so a stale banner never lingers if the shopper leaves the tab open past
// the expiry.
export function PromoTimer({
  endsAt,
  label,
  locale = 'uk',
}: {
  endsAt: string
  label: string
  locale?: PromoTimerLocale
}) {
  const deadline = useState(() => new Date(endsAt).getTime())[0]
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    // Seed the countdown after mount so SSR and the first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(deadline - Date.now())
    const id = setInterval(() => setRemaining(deadline - Date.now()), 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (remaining !== null && remaining <= 0) return null

  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
      <Flame className="size-4 shrink-0" />
      <span>
        {label}{' '}
        <span className="font-mono tabular-nums" aria-hidden={remaining === null ? true : undefined}>
          {remaining === null ? '--:--:--' : formatRemaining(remaining, locale)}
        </span>
      </span>
    </div>
  )
}

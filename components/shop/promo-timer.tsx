'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  // Once the countdown crosses a day, hours keep accumulating (e.g. 27:14:33)
  // instead of wrapping — still an honest "time left", just not split into days.
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// Live "Акція діє ще: HH:MM:SS" countdown for a product covered by a real,
// currently-active automatic promotion with a deadline (see
// getProductPromotionDeadline in lib/shop/queries.ts). Ticks client-side
// every second; unmounts itself once the deadline passes so a stale banner
// never lingers if the shopper leaves the tab open past the expiry.
export function PromoTimer({ endsAt, label }: { endsAt: string; label: string }) {
  const deadline = useState(() => new Date(endsAt).getTime())[0]
  const [remaining, setRemaining] = useState(() => deadline - Date.now())

  useEffect(() => {
    const id = setInterval(() => setRemaining(deadline - Date.now()), 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (remaining <= 0) return null

  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
      <Flame className="size-4 shrink-0" />
      <span>
        {label} <span className="font-mono tabular-nums">{formatRemaining(remaining)}</span>
      </span>
    </div>
  )
}

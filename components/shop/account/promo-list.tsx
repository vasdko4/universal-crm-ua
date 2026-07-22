'use client'

import { useState } from 'react'
import { Check, Copy, TicketPercent } from 'lucide-react'
import type { CustomerPromo } from '@/app/actions/customer-promos'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  })
}

export function PromoList({ promos }: { promos: CustomerPromo[] }) {
  const { dict, locale } = useI18n()
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const t = dict.account

  async function copy(promo: CustomerPromo) {
    try {
      await navigator.clipboard.writeText(promo.code)
      setCopiedId(promo.id)
      setTimeout(() => setCopiedId((v) => (v === promo.id ? null : v)), 2000)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">{t.promosTitle}</h1>
      {promos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
          <TicketPercent className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">{t.promosEmpty}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {promos.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-bold tracking-wide text-foreground">
                    {p.code}
                  </span>
                  <Badge variant="secondary">
                    {p.discountType === 'percentage'
                      ? `-${p.discountValue}%`
                      : `-${p.discountValue.toLocaleString('ru-RU')} ₴`}
                  </Badge>
                  {p.usedByMe && <Badge variant="outline">{t.promoUsed}</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.minOrderAmount != null &&
                    `${t.promoMinOrder}: ${p.minOrderAmount.toLocaleString('ru-RU')} ₴ · `}
                  {p.endsAt ? `${t.promoUntil} ${formatDate(p.endsAt, locale)}` : t.promoNoExpiry}
                  {p.usesLeft != null && ` · ${t.promoUsesLeft}: ${p.usesLeft}`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(p)}
                className="shrink-0 bg-transparent"
              >
                {copiedId === p.id ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                {copiedId === p.id ? t.promoCopied : t.promoCopy}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

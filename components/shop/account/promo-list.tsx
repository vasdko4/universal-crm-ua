'use client'

import { useState } from 'react'
import { Check, Copy, TicketPercent } from 'lucide-react'
import type { CustomerPromo } from '@/app/actions/customer-promos'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/shop/format'
import { SectionHeader, EmptyState } from '@/components/shop/account/account-ui'
import { cn } from '@/lib/utils'

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
    <div className="space-y-4 sm:space-y-5">
      <SectionHeader title={t.promosTitle} description={t.promosDescription} />
      {promos.length === 0 ? (
        <EmptyState icon={TicketPercent} title={t.promosEmpty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {promos.map((p) => (
            <li
              key={p.id}
              className={cn(
                'relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
                p.usedByMe && 'opacity-70',
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/70 to-primary/20"
              />
              <div className="flex min-w-0 flex-col gap-1.5 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 font-mono text-base font-bold tracking-widest text-foreground">
                    {p.code}
                  </span>
                  <Badge variant="secondary">
                    {p.discountType === 'percentage'
                      ? `-${p.discountValue}%`
                      : `-${formatPrice(p.discountValue, 'UAH', locale)}`}
                  </Badge>
                  {p.usedByMe && <Badge variant="outline">{t.promoUsed}</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.minOrderAmount != null &&
                    `${t.promoMinOrder}: ${formatPrice(p.minOrderAmount, 'UAH', locale)} · `}
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

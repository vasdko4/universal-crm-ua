'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PromoTimer } from '@/components/shop/promo-timer'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath, stripLocalePrefix, type Locale } from '@/lib/i18n/config'
import { formatPrice } from '@/lib/shop/format'
import type { ActivePromotion } from '@/lib/shop/queries'

const SESSION_KEY = 'promo-popup-shown'

const STRINGS: Record<
  Locale,
  { title: string; atCheckout: string; cta: string; openEnded: string; timerLabel: string }
> = {
  uk: {
    title: 'Акція',
    atCheckout: 'Знижка застосується при оформленні замовлення.',
    cta: 'Переглянути акції',
    openEnded: 'Акція діє без обмеження строку.',
    timerLabel: 'Акція діє ще:',
  },
  ru: {
    title: 'Акция',
    atCheckout: 'Скидка применится при оформлении заказа.',
    cta: 'Посмотреть акции',
    openEnded: 'Акция действует без ограничения срока.',
    timerLabel: 'Акция действует ещё:',
  },
}

/**
 * The entry popup is shown only on storefront browsing pages: home, catalog,
 * categories, and product pages (locale-prefix aware). It never appears on
 * /promotions, /checkout, /cart, /account, /admin, or anywhere else.
 */
export function isPromoPopupEligiblePath(pathname: string): boolean {
  let path = stripLocalePrefix(pathname)
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (!path) path = '/'
  if (path === '/') return true
  if (path === '/catalog' || path.startsWith('/catalog/')) return true
  if (path === '/category' || path.startsWith('/category/')) return true
  if (path.startsWith('/product/') || path.startsWith('/p/')) return true
  return false
}

/** Honest discount label — the same rendering as /promotions. */
export function promoDiscountLabel(promo: ActivePromotion, locale: Locale): string {
  return promo.discountType === 'percentage'
    ? `−${promo.discountValue}%`
    : `−${formatPrice(promo.discountValue, 'UAH', locale)}`
}

// Entry popup: shows the currently-live campaign once per session, on site
// entry. Dismissible via X / backdrop click / Escape (Radix Dialog). Content
// is real data only, from getActivePromotions — no invented discounts, and
// the discount applies at checkout, never to a struck-through price.
export function PromoPopupHost({ promo }: { promo: ActivePromotion }) {
  const pathname = usePathname()
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const t = STRINGS[locale]

  useEffect(() => {
    if (!isPromoPopupEligiblePath(pathname)) return
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // sessionStorage unavailable (e.g. private mode) — show once per mount.
    }
    // Open on mount: the popup must appear as soon as the visitor lands.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true)
  }, [pathname])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="promo-popup"
        className="max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-md"
      >
        <div className="bg-gradient-to-br from-[#0F766E] to-[#115e59] px-6 pb-5 pt-6 text-white">
          <DialogTitle className="text-lg font-bold leading-snug">{t.title}</DialogTitle>
          <p className="mt-1 text-xl font-extrabold leading-tight">{promo.name}</p>
          <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-lg font-bold">
            {promoDiscountLabel(promo, locale)}
          </p>
        </div>
        <div className="space-y-4 px-6 pb-6 pt-4">
          {promo.endsAt ? (
            <PromoTimer endsAt={promo.endsAt} label={t.timerLabel} locale={locale} />
          ) : (
            <p className="text-sm font-medium text-muted-foreground">{t.openEnded}</p>
          )}
          <p className="text-sm text-muted-foreground">{t.atCheckout}</p>
          <Link
            href={localizedPath('/promotions', locale)}
            onClick={() => setOpen(false)}
            className="block rounded-xl bg-[#EA580C] px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-[#c2410c]"
          >
            {t.cta}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

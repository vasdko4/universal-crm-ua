'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'
import { readConsentCookie, writeConsentCookie, updateGtagConsent } from '@/lib/shop/consent'

// Lightweight Google Consent Mode v2 prompt. Only rendered when the shop
// actually has Google Ads/Analytics configured (see (shop)/layout.tsx) —
// nothing to ask consent for otherwise. gtag's default consent state starts
// "denied" (components/shop/google-ads.tsx); this banner is the only way a
// visitor grants "granted", so ad/analytics storage stays legally denied
// until they explicitly accept.
export function CookieConsentBanner() {
  const { dict } = useI18n()
  const t = dict.cookieConsent
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already decided on a previous visit — google-ads.tsx already applied
    // 'granted' synchronously in its init script if the cookie says so, so
    // there's nothing left to do here except stay hidden.
    if (readConsentCookie() === null) setVisible(true)
  }, [])

  function choose(choice: 'granted' | 'denied') {
    writeConsentCookie(choice)
    updateGtagConsent(choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/98 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-sm text-muted-foreground sm:text-left">{t.message}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('denied')}>
            {t.decline}
          </Button>
          <Button size="sm" onClick={() => choose('granted')}>
            {t.accept}
          </Button>
        </div>
      </div>
    </div>
  )
}

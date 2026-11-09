'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'
import { readConsentCookie, writeConsentCookie, updateGtagConsent } from '@/lib/shop/consent'

function subscribeNoop() {
  return () => {}
}

// Lightweight Google Consent Mode v2 prompt, as a modal dialog instead of a
// bottom bar. Only rendered when the shop actually has Google Ads/Analytics
// configured (see (shop)/layout.tsx) — nothing to ask consent for otherwise.
// gtag's default consent state starts "denied" (components/shop/google-ads.tsx);
// this modal is the only way a visitor grants "granted", so ad/analytics
// storage stays legally denied until they explicitly accept.
//
// Mobile: the dialog docks to the bottom as a full-width sheet with side
// margins and safe-area padding, buttons stacked full-width; on sm+ it is a
// centered card. Background scroll is locked while the modal is open, and
// the only way out is choosing Accept or Decline (no backdrop dismiss).
export function CookieConsentModal() {
  const { dict } = useI18n()
  const t = dict.cookieConsent
  // Already decided on a previous visit — google-ads.tsx already applied
  // 'granted' synchronously in its init script if the cookie says so, so
  // there's nothing left to do here except stay hidden. Read the cookie via
  // useSyncExternalStore (server snapshot: not-yet-decided is never shown, to
  // match SSR where cookies aren't readable) instead of an effect, so the
  // modal can appear on the very first client render with no flash.
  const undecided = useSyncExternalStore(subscribeNoop, () => readConsentCookie() === null, () => false)
  const [dismissed, setDismissed] = useState(false)
  const visible = undecided && !dismissed

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  function choose(choice: 'granted' | 'denied') {
    writeConsentCookie(choice)
    updateGtagConsent(choice)
    setDismissed(true)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.message}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <p className="text-center text-sm leading-relaxed text-muted-foreground sm:text-left">
          {t.message}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => choose('denied')}>
            {t.decline}
          </Button>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => choose('granted')}>
            {t.accept}
          </Button>
        </div>
      </div>
    </div>
  )
}

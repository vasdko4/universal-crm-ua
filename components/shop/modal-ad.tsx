'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { trackModalAdEvent, type PublicModalAd } from '@/app/actions/modal-ads'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath, type Locale } from '@/lib/i18n/config'
import {
  classifyStorefrontPath,
  emptyCapState,
  markDismissed,
  markShown,
  pickEligibleAd,
  type ModalCapState,
} from '@/lib/shop/modal-ad-rules'

function localizeHref(href: string, locale: Locale): string {
  if (!href || href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href
  if (!href.startsWith('/')) return href
  return localizedPath(href, locale)
}

const LS_KEY = 'modal-ad-cap'
const SS_KEY = 'modal-ad-session'
const LEGACY_LS = 'modal-ad-seen'

function readJson(raw: string | null): Record<string, unknown> {
  try {
    const v = JSON.parse(raw ?? '')
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

function loadCapState(): ModalCapState {
  const state = emptyCapState()
  if (typeof window === 'undefined') return state

  const persisted = readJson(localStorage.getItem(LS_KEY))
  state.lastAnyAt = typeof persisted.lastAnyAt === 'number' ? persisted.lastAnyAt : null
  state.shownAt = numberMap(persisted.shownAt)
  state.dismissedAt = numberMap(persisted.dismissedAt)

  // Older builds stored last-view timestamps as { [id]: epoch }.
  const legacy = numberMap(readJson(localStorage.getItem(LEGACY_LS)))
  for (const [id, at] of Object.entries(legacy)) {
    if (state.shownAt[id] == null) state.shownAt[id] = at
    if (state.lastAnyAt == null || at > state.lastAnyAt) state.lastAnyAt = at
  }

  const session = readJson(sessionStorage.getItem(SS_KEY))
  state.anyThisSession = session.any === true
  const ids = session.ids
  if (ids && typeof ids === 'object') {
    for (const id of Object.keys(ids as Record<string, unknown>)) {
      state.sessionShown[id] = true
      state.anyThisSession = true
    }
  }
  return state
}

function persistCapState(state: ModalCapState) {
  localStorage.setItem(
    LS_KEY,
    JSON.stringify({
      lastAnyAt: state.lastAnyAt,
      shownAt: state.shownAt,
      dismissedAt: state.dismissedAt,
    }),
  )
  sessionStorage.setItem(
    SS_KEY,
    JSON.stringify({ any: state.anyThisSession, ids: state.sessionShown }),
  )
}

const SIZE_CLASS: Record<string, string> = {
  small: 'sm:max-w-sm',
  medium: 'sm:max-w-md',
  large: 'sm:max-w-xl',
}

function contrastText(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return '#ffffff'
  const n = Number.parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff'
}

export function ModalAdHost({ ads }: { ads: PublicModalAd[] }) {
  const pathname = usePathname()
  const { locale, dict } = useI18n()
  const [current, setCurrent] = useState<PublicModalAd | null>(null)
  const firedRef = useRef(false)
  const capRef = useRef<ModalCapState>(emptyCapState())

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setCurrent(null)
  }

  useEffect(() => {
    firedRef.current = false
    capRef.current = loadCapState()

    const page = classifyStorefrontPath(pathname)
    const ad = pickEligibleAd(ads, page, capRef.current, Date.now())
    if (!ad) return
    const full = ads.find((a) => a.id === ad.id)
    if (!full) return

    const fire = () => {
      if (firedRef.current) return
      firedRef.current = true
      capRef.current = markShown(capRef.current, full.id, Date.now())
      persistCapState(capRef.current)
      setCurrent(full)
      void trackModalAdEvent(full.id, 'view')
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      if (max <= 0) return
      if ((window.scrollY / max) * 100 >= full.triggerValue) fire()
    }
    const onExit = (e: MouseEvent) => {
      if (e.clientY <= 0) fire()
    }

    if (full.triggerType === 'delay') {
      // Never pop in the first seconds of a visit — even if the campaign is set to 0.
      timer = setTimeout(fire, Math.max(8, full.triggerValue) * 1000)
    } else if (full.triggerType === 'scroll') {
      window.addEventListener('scroll', onScroll, { passive: true })
    } else if (window.matchMedia('(pointer: coarse)').matches) {
      timer = setTimeout(fire, Math.max(8, full.triggerValue || 12) * 1000)
    } else {
      document.addEventListener('mouseout', onExit)
    }

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onExit)
    }
  }, [pathname, ads])

  if (!current) return null

  const close = () => {
    capRef.current = markDismissed(capRef.current, current.id, Date.now())
    persistCapState(capRef.current)
    void trackModalAdEvent(current.id, 'close')
    setCurrent(null)
  }

  const clickLink = () => {
    void trackModalAdEvent(current.id, 'click')
  }

  const clickButton = () => {
    void trackModalAdEvent(current.id, 'click')
    setCurrent(null)
  }

  const buttonStyle = current.buttonColor
    ? { backgroundColor: current.buttonColor, color: contrastText(current.buttonColor) }
    : undefined

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className={`max-h-[min(88dvh,560px)] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-border/60 p-0 shadow-xl ${SIZE_CLASS[current.size] ?? SIZE_CLASS.medium}`}
      >
        {current.imageUrl && (
          <div className="relative aspect-[2/1] w-full bg-secondary sm:aspect-[16/9]">
            <Image
              src={current.imageUrl || '/placeholder.svg'}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 92vw, 480px"
              quality={70}
            />
          </div>
        )}
        <div className={`flex flex-col gap-2 px-5 pb-5 text-center sm:px-6 sm:pb-6 ${current.imageUrl ? 'pt-4' : 'pt-8'}`}>
          <DialogTitle className="text-balance text-lg font-semibold leading-snug sm:text-xl">
            {current.title}
          </DialogTitle>
          {current.body && (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          )}
          {current.buttonText && (
            <div className="mt-3">
              {current.buttonUrl ? (
                <Button asChild className="h-11 w-full font-medium" size="lg" style={buttonStyle}>
                  <Link href={localizeHref(current.buttonUrl, locale)} onClick={clickLink}>
                    {current.buttonText}
                  </Link>
                </Button>
              ) : (
                <Button className="h-11 w-full font-medium" size="lg" style={buttonStyle} onClick={clickButton}>
                  {current.buttonText}
                </Button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className="mx-auto mt-1 min-h-10 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {dict.common.notNowThanks}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

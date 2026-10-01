'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { trackModalAdEvent, type PublicModalAd } from '@/app/actions/modal-ads'
import { useI18n } from '@/lib/i18n/client'
import { isProxiedMedia } from '@/lib/shop/own-image-url'
import { localizedPath, type Locale } from '@/lib/i18n/config'
import { normalizeModalAdTheme, type ModalAdTheme } from '@/lib/shop/modal-ad-themes'
import { Gift, Sparkles, Ticket, BadgePercent } from 'lucide-react'
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
  try {
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
  } catch {
    return emptyCapState()
  }
  return state
}

function persistCapState(state: ModalCapState) {
  try {
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
  } catch {
    // Safari private mode / quota — fail open, do not crash the storefront.
  }
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

// ---------------------------------------------------------------------------
// Pure presentational popup. Reused by the storefront host below and by the
// admin live preview (which passes static props, no callbacks).
// ---------------------------------------------------------------------------

export type ModalAdVisualData = {
  title: string
  body: string | null
  imageUrl: string | null
  buttonText: string | null
  buttonColor: string | null
  theme: ModalAdTheme | string | null
}

type VisualAction =
  | { kind: 'link'; href: string; onClick?: () => void }
  | { kind: 'button'; onClick?: () => void }
  | null

function CtaButton({
  action,
  label,
  className,
  style,
}: {
  action: VisualAction
  label: string
  className?: string
  style?: React.CSSProperties
}) {
  if (!action) return null
  if (action.kind === 'link') {
    return (
      <Button asChild className={className} size="lg" style={style}>
        <Link href={action.href} onClick={action.onClick}>
          {label}
        </Link>
      </Button>
    )
  }
  if (!action.onClick) {
    // Static preview (admin): non-interactive, keeps the look.
    return (
      <span
        className={`inline-flex items-center justify-center ${className ?? ''}`}
        style={style}
        aria-hidden
      >
        {label}
      </span>
    )
  }
  return (
    <Button className={className} size="lg" style={style} onClick={action.onClick}>
      {label}
    </Button>
  )
}

function DismissLink({
  label,
  onDismiss,
  className,
}: {
  label: string
  onDismiss?: (() => void) | null
  className?: string
}) {
  if (!onDismiss) {
    return <span className={className}>{label}</span>
  }
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`min-h-10 px-3 transition-colors ${className ?? ''}`}
    >
      {label}
    </button>
  )
}

function AdImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <Image
      src={src || '/placeholder.svg'}
      alt={alt}
      fill
      className={className ?? 'object-cover'}
      sizes="(max-width: 640px) 92vw, 560px"
      quality={70}
      unoptimized={isProxiedMedia(src)}
    />
  )
}

export function ModalAdVisual({
  ad,
  action,
  dismissLabel,
  onDismiss,
}: {
  ad: ModalAdVisualData
  action: VisualAction
  dismissLabel: string
  onDismiss?: (() => void) | null
}) {
  const theme = normalizeModalAdTheme(ad.theme)
  const buttonStyle = ad.buttonColor
    ? { backgroundColor: ad.buttonColor, color: contrastText(ad.buttonColor) }
    : undefined

  switch (theme) {
    case 'gradient':
      return (
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-white/20 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-12 size-64 rounded-full bg-black/10 blur-2xl" />
          <div className="relative flex flex-col items-center gap-2 px-6 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg backdrop-blur-sm">
              <Gift className="size-7" />
            </span>
            {ad.imageUrl && (
              <div className="relative mt-2 aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-xl">
                <AdImage src={ad.imageUrl} alt="" />
              </div>
            )}
            <DialogTitle className="mt-2 text-balance text-2xl font-extrabold leading-tight text-white drop-shadow-sm">
              {ad.title}
            </DialogTitle>
            {ad.body && (
              <p className="text-pretty text-sm leading-relaxed text-white/85">{ad.body}</p>
            )}
            {ad.buttonText && (
              <div className="mt-3 w-full">
                <CtaButton
                  action={action}
                  label={ad.buttonText}
                  className="h-12 w-full rounded-full bg-white font-bold text-fuchsia-700 shadow-xl hover:bg-white/95"
                />
              </div>
            )}
            <DismissLink
              label={dismissLabel}
              onDismiss={onDismiss}
              className="mt-1 text-sm text-white/75 hover:text-white"
            />
          </div>
        </div>
      )

    case 'split':
      return (
        <div className="grid sm:grid-cols-2">
          <div className="relative min-h-44 overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-600 sm:min-h-full">
            {ad.imageUrl ? (
              <AdImage src={ad.imageUrl} alt="" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <BadgePercent className="size-16 text-white/70" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center gap-2 bg-white px-6 py-6 text-left sm:px-7 sm:py-8">
            <DialogTitle className="text-balance text-xl font-extrabold leading-snug text-zinc-900 sm:text-2xl">
              {ad.title}
            </DialogTitle>
            {ad.body && (
              <p className="text-pretty text-sm leading-relaxed text-zinc-500">{ad.body}</p>
            )}
            {ad.buttonText && (
              <div className="mt-3">
                <CtaButton
                  action={action}
                  label={ad.buttonText}
                  className="h-11 w-full rounded-xl font-semibold"
                  style={buttonStyle}
                />
              </div>
            )}
            <DismissLink
              label={dismissLabel}
              onDismiss={onDismiss}
              className="mt-1 self-start text-sm text-zinc-400 hover:text-zinc-700"
            />
          </div>
        </div>
      )

    case 'minimal':
      return (
        <div className="flex flex-col items-center gap-2 bg-white px-6 pb-6 pt-10 text-center sm:px-10 sm:pt-12">
          <DialogTitle className="text-balance text-2xl font-semibold leading-snug tracking-tight text-zinc-900 sm:text-[1.7rem]">
            {ad.title}
          </DialogTitle>
          <span aria-hidden className="my-1 h-px w-12 bg-zinc-200" />
          {ad.body && (
            <p className="max-w-sm text-pretty text-sm leading-relaxed text-zinc-500">{ad.body}</p>
          )}
          {ad.imageUrl && (
            <div className="relative mt-2 aspect-[16/9] w-full overflow-hidden rounded-xl">
              <AdImage src={ad.imageUrl} alt="" />
            </div>
          )}
          {ad.buttonText && (
            <div className="mt-4 w-full">
              <CtaButton
                action={action}
                label={ad.buttonText}
                className="h-12 w-full rounded-full font-semibold"
                style={
                  buttonStyle ?? { backgroundColor: '#18181b', color: '#ffffff' }
                }
              />
            </div>
          )}
          <DismissLink
            label={dismissLabel}
            onDismiss={onDismiss}
            className="mt-1 text-sm text-zinc-400 underline-offset-4 hover:text-zinc-700 hover:underline"
          />
        </div>
      )

    case 'dark':
      return (
        <div className="relative overflow-hidden bg-zinc-950">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
          {ad.imageUrl && (
            <div className="relative aspect-[16/8] w-full">
              <AdImage src={ad.imageUrl} alt="" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
            </div>
          )}
          <div className={`relative flex flex-col items-center gap-2 px-6 pb-6 text-center sm:px-8 ${ad.imageUrl ? '-mt-6 pt-0' : 'pt-10'}`}>
            <span className="flex size-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Sparkles className="size-6" />
            </span>
            <DialogTitle className="mt-1 text-balance text-2xl font-bold leading-tight text-white">
              {ad.title}
            </DialogTitle>
            {ad.body && (
              <p className="text-pretty text-sm leading-relaxed text-zinc-400">{ad.body}</p>
            )}
            {ad.buttonText && (
              <div className="mt-3 w-full">
                <CtaButton
                  action={action}
                  label={ad.buttonText}
                  className="h-12 w-full rounded-xl font-bold"
                  style={buttonStyle ?? { backgroundColor: '#fbbf24', color: '#18181b' }}
                />
              </div>
            )}
            <DismissLink
              label={dismissLabel}
              onDismiss={onDismiss}
              className="mt-1 text-sm text-zinc-500 hover:text-zinc-300"
            />
          </div>
        </div>
      )

    case 'ticket':
      return (
        <div className="bg-white">
          <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 to-orange-500 px-6 pb-7 pt-8 text-center sm:px-8">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15" />
            <div aria-hidden className="pointer-events-none absolute -bottom-14 -left-8 size-44 rounded-full bg-black/10" />
            <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg">
              <Ticket className="size-7" />
            </span>
            <DialogTitle className="relative mt-3 text-balance text-2xl font-extrabold uppercase leading-tight tracking-wide text-white">
              {ad.title}
            </DialogTitle>
          </div>
          <div className="border-t-2 border-dashed border-zinc-200 px-6 py-5 text-center sm:px-8">
            {ad.imageUrl && (
              <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-xl">
                <AdImage src={ad.imageUrl} alt="" />
              </div>
            )}
            {ad.body && (
              <p className="text-pretty text-sm leading-relaxed text-zinc-600">{ad.body}</p>
            )}
            {ad.buttonText && (
              <div className="mt-4">
                <CtaButton
                  action={action}
                  label={ad.buttonText}
                  className="h-12 w-full rounded-xl font-bold uppercase tracking-wide"
                  style={buttonStyle ?? { backgroundColor: '#e11d48', color: '#ffffff' }}
                />
              </div>
            )}
            <DismissLink
              label={dismissLabel}
              onDismiss={onDismiss}
              className="mt-1 text-sm text-zinc-400 hover:text-zinc-700"
            />
          </div>
        </div>
      )

    case 'classic':
    default:
      return (
        <div className="bg-white">
          {ad.imageUrl && (
            <div className="relative aspect-[2/1] w-full bg-zinc-100 sm:aspect-[16/9]">
              <AdImage src={ad.imageUrl} alt="" />
            </div>
          )}
          <div className={`flex flex-col items-center gap-2 px-5 pb-5 text-center sm:px-6 sm:pb-6 ${ad.imageUrl ? 'pt-5' : 'pt-9'}`}>
            <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
              <Sparkles className="size-6" />
            </span>
            <DialogTitle className="text-balance text-xl font-bold leading-snug text-zinc-900 sm:text-2xl">
              {ad.title}
            </DialogTitle>
            {ad.body && (
              <p className="text-pretty text-sm leading-relaxed text-zinc-500">{ad.body}</p>
            )}
            {ad.buttonText && (
              <div className="mt-3 w-full">
                <CtaButton
                  action={action}
                  label={ad.buttonText}
                  className="h-12 w-full rounded-xl font-semibold shadow-sm"
                  style={buttonStyle}
                />
              </div>
            )}
            <DismissLink
              label={dismissLabel}
              onDismiss={onDismiss}
              className="mt-1 text-sm text-zinc-400 hover:text-zinc-700"
            />
          </div>
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Storefront host: trigger logic + dialog shell.
// ---------------------------------------------------------------------------

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

  const action: VisualAction = current.buttonText
    ? current.buttonUrl
      ? { kind: 'link', href: localizeHref(current.buttonUrl, locale), onClick: clickLink }
      : { kind: 'button', onClick: clickButton }
    : null

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className={`max-h-[min(88dvh,600px)] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-3xl border-0 p-0 shadow-2xl ${SIZE_CLASS[current.size] ?? SIZE_CLASS.medium}`}
      >
        <ModalAdVisual
          ad={current}
          action={action}
          dismissLabel={dict.common.notNowThanks}
          onDismiss={close}
        />
      </DialogContent>
    </Dialog>
  )
}

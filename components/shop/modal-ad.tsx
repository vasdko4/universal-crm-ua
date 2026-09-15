'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { trackModalAdEvent, type PublicModalAd } from '@/app/actions/modal-ads'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath, stripLocalePrefix, type Locale } from '@/lib/i18n/config'

function localizeHref(href: string, locale: Locale): string {
  if (!href || href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href
  if (!href.startsWith('/')) return href
  return localizedPath(href, locale)
}

// Frequency capping is inherently per-browser state, so localStorage /
// sessionStorage is the correct storage here (not app data).
const LS_KEY = 'modal-ad-seen' // { [id]: epoch ms of last view }

function pageType(pathname: string): 'home' | 'catalog' | 'product' | 'cart' | 'other' {
  const path = stripLocalePrefix(pathname)
  if (path === '/') return 'home'
  if (path === '/catalog' || path.startsWith('/catalog/')) return 'catalog'
  if (path.startsWith('/product/')) return 'product'
  if (path === '/cart' || path === '/checkout') return 'cart'
  return 'other'
}

function readSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function sessionKey(id: number) {
  return `modal-ad-s-${id}`
}

function canShow(ad: PublicModalAd): boolean {
  // Never re-open the same campaign in this tab after it already fired —
  // "every page" used to spam a popup on each navigation.
  if (sessionStorage.getItem(sessionKey(ad.id))) return false
  if (ad.frequency === 'every' || ad.frequency === 'session') return true
  const seen = readSeen()[String(ad.id)]
  if (!seen) return true
  return Date.now() - seen > ad.frequencyDays * 24 * 60 * 60 * 1000
}

function markShown(ad: PublicModalAd) {
  sessionStorage.setItem(sessionKey(ad.id), '1')
  if (ad.frequency === 'days') {
    const seen = readSeen()
    seen[String(ad.id)] = Date.now()
    localStorage.setItem(LS_KEY, JSON.stringify(seen))
  }
}

const SIZE_CLASS: Record<string, string> = {
  small: 'sm:max-w-sm',
  medium: 'sm:max-w-md',
  large: 'sm:max-w-xl',
}

// Pick readable text color (black/white) for an arbitrary hex background.
function contrastText(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return '#ffffff'
  const n = Number.parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // Perceived luminance (ITU-R BT.601)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff'
}

export function ModalAdHost({ ads }: { ads: PublicModalAd[] }) {
  const pathname = usePathname()
  const { locale, dict } = useI18n()
  const [current, setCurrent] = useState<PublicModalAd | null>(null)
  const firedRef = useRef(false)

  // Hide any ad from the previous page the instant the route changes —
  // adjusted during render (comparing against the previous pathname)
  // instead of in the effect below, so the reset lands in the same render
  // as the navigation rather than a render after it.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setCurrent(null)
  }

  useEffect(() => {
    firedRef.current = false

    const pt = pageType(pathname)
    // Never show popups over admin/auth/setup surfaces.
    if (pt === 'other') return

    const eligible = ads.filter(
      (ad) => (ad.targetPages.includes('all') || ad.targetPages.includes(pt)) && canShow(ad),
    )
    const ad = eligible[0]
    if (!ad) return

    const fire = () => {
      if (firedRef.current) return
      firedRef.current = true
      markShown(ad)
      setCurrent(ad)
      void trackModalAdEvent(ad.id, 'view')
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      if (max <= 0) return
      if ((window.scrollY / max) * 100 >= ad.triggerValue) fire()
    }
    const onExit = (e: MouseEvent) => {
      if (e.clientY <= 0) fire()
    }

    if (ad.triggerType === 'delay') {
      timer = setTimeout(fire, Math.max(0, ad.triggerValue) * 1000)
    } else if (ad.triggerType === 'scroll') {
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    } else if (window.matchMedia('(pointer: coarse)').matches) {
      // Exit-intent is a desktop mouse gesture; on phones it never fires
      // (or fires spuriously). Fall back to a one-shot delay instead.
      timer = setTimeout(fire, Math.max(4, ad.triggerValue || 5) * 1000)
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
    void trackModalAdEvent(current.id, 'close')
    setCurrent(null)
  }

  // For link CTAs we only track and let Next.js navigate; unmounting the
  // <Link> synchronously would cancel the navigation. The dialog disappears
  // with the route change. Plain-button CTAs close the dialog directly.
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
        className={`max-h-[min(88dvh,640px)] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-2xl border-none p-0 shadow-2xl ${SIZE_CLASS[current.size] ?? SIZE_CLASS.medium}`}
      >
        {current.imageUrl && (
          <div className="relative aspect-[2/1] w-full bg-secondary sm:aspect-[16/9]">
            <Image
              src={current.imageUrl || '/placeholder.svg'}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 92vw, 576px"
              quality={70}
            />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background/90 to-transparent" />
          </div>
        )}
        <div className={`flex flex-col gap-2.5 px-4 pb-5 text-center sm:px-6 sm:pb-6 ${current.imageUrl ? 'pt-3' : 'pt-8'}`}>
          <DialogTitle className="text-balance text-lg font-bold leading-tight sm:text-2xl">
            {current.title}
          </DialogTitle>
          {current.body && (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          )}
          {current.buttonText && (
            <div className="mt-2">
              {current.buttonUrl ? (
                <Button asChild className="h-11 w-full font-semibold" size="lg" style={buttonStyle}>
                  <Link href={localizeHref(current.buttonUrl, locale)} onClick={clickLink}>
                    {current.buttonText}
                  </Link>
                </Button>
              ) : (
                <Button className="h-11 w-full font-semibold" size="lg" style={buttonStyle} onClick={clickButton}>
                  {current.buttonText}
                </Button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className="mx-auto mt-1 min-h-10 px-3 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {dict.common.notNowThanks}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

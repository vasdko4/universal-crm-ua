'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { trackModalAdEvent, type PublicModalAd } from '@/app/actions/modal-ads'

// Frequency capping is inherently per-browser state, so localStorage /
// sessionStorage is the correct storage here (not app data).
const LS_KEY = 'modal-ad-seen' // { [id]: epoch ms of last view }

function pageType(pathname: string): 'home' | 'catalog' | 'product' | 'cart' | 'other' {
  if (pathname === '/') return 'home'
  if (pathname === '/catalog' || pathname.startsWith('/catalog/')) return 'catalog'
  if (pathname.startsWith('/product/')) return 'product'
  if (pathname === '/cart' || pathname === '/checkout') return 'cart'
  return 'other'
}

function readSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function canShow(ad: PublicModalAd): boolean {
  if (ad.frequency === 'every') return true
  if (ad.frequency === 'session') {
    return !sessionStorage.getItem(`modal-ad-s-${ad.id}`)
  }
  // days
  const seen = readSeen()[String(ad.id)]
  if (!seen) return true
  return Date.now() - seen > ad.frequencyDays * 24 * 60 * 60 * 1000
}

function markShown(ad: PublicModalAd) {
  if (ad.frequency === 'session') {
    sessionStorage.setItem(`modal-ad-s-${ad.id}`, '1')
  } else if (ad.frequency === 'days') {
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
        className={`gap-0 overflow-hidden rounded-2xl border-none p-0 shadow-2xl ${SIZE_CLASS[current.size] ?? SIZE_CLASS.medium}`}
      >
        {current.imageUrl && (
          <div className="relative aspect-[16/9] w-full bg-secondary">
            <Image
              src={current.imageUrl || '/placeholder.svg'}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 576px"
              priority
            />
            {/* Soft fade so the image blends into the content area */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
          </div>
        )}
        <div className={`flex flex-col gap-3 px-6 pb-6 text-center ${current.imageUrl ? 'pt-3' : 'pt-8'}`}>
          <DialogTitle className="text-balance text-2xl font-bold leading-tight">
            {current.title}
          </DialogTitle>
          {current.body && (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          )}
          {current.buttonText && (
            <div className="mt-3">
              {current.buttonUrl ? (
                <Button asChild className="w-full font-semibold" size="lg" style={buttonStyle}>
                  <Link href={current.buttonUrl} onClick={clickLink}>
                    {current.buttonText}
                  </Link>
                </Button>
              ) : (
                <Button className="w-full font-semibold" size="lg" style={buttonStyle} onClick={clickButton}>
                  {current.buttonText}
                </Button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className="mx-auto mt-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Не зараз, дякую
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

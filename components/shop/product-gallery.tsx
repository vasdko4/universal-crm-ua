'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  images: string[]
  alt: string
  discount?: number
  noPhotoLabel: string
  // When provided (e.g. after picking a color), jump the gallery to this image.
  selectedImage?: string | null
}

export function ProductGallery({ images, alt, discount = 0, noPhotoLabel, selectedImage }: Props) {
  const gallery = images.filter(Boolean)
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  // Sync the active image when a variant (color) selection drives it
  // externally. Adjusted during render (comparing against the previous
  // `selectedImage`) instead of in an effect.
  const [prevSelectedImage, setPrevSelectedImage] = useState(selectedImage)
  if (selectedImage !== prevSelectedImage) {
    setPrevSelectedImage(selectedImage)
    if (selectedImage) {
      const idx = gallery.indexOf(selectedImage)
      if (idx >= 0) setActive(idx)
    }
  }

  const hasImages = gallery.length > 0
  const count = gallery.length
  const safeActive = Math.min(active, count - 1)
  const current = hasImages ? gallery[safeActive] : null
  const hasThumbs = count > 1

  function goTo(i: number) {
    setActive(((i % count) + count) % count)
  }
  function prev() {
    goTo(safeActive - 1)
  }
  function next() {
    goTo(safeActive + 1)
  }

  // Keep the active thumbnail visible inside the scrollable rail/strip.
  useEffect(() => {
    thumbRefs.current[safeActive]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [safeActive])

  // Swipe on the main image (mobile) to change photos.
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null || count < 2) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Ignore mostly-vertical gestures (page scroll).
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) prev()
    else next()
  }

  // Keyboard navigation when the gallery has focus.
  function onKeyDown(e: React.KeyboardEvent) {
    if (count < 2) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    }
  }

  return (
    // Desktop: vertical thumbnail rail on the left + large main image.
    // Mobile: large main image with a horizontal thumbnail strip beneath it.
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
      {hasThumbs && (
        <div
          className={cn(
            'order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[620px] lg:w-[70px] lg:flex-col lg:justify-start lg:overflow-y-auto lg:pb-0',
          )}
        >
          {gallery.map((src, i) => (
            <button
              key={src + i}
              ref={(el) => {
                thumbRefs.current[i] = el
              }}
              type="button"
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              aria-label={`${alt} — ${i + 1}`}
              aria-current={i === safeActive}
              className={cn(
                'relative size-14 shrink-0 overflow-hidden rounded-lg border bg-card transition lg:size-[62px]',
                i === safeActive
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'border-border hover:border-primary/60',
              )}
            >
              <Image src={src || '/placeholder.svg'} alt="" fill sizes="62px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}

      {/* Main image — capped at 440x440 on mobile and 620x620 on desktop */}
      <div
        role="region"
        aria-label={alt}
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="group relative order-1 mx-auto aspect-square w-full overflow-hidden rounded-2xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:max-w-[440px] lg:order-2 lg:max-w-[620px]"
      >
        {current ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="relative block h-full w-full cursor-zoom-in touch-pan-y"
            aria-label={`${alt} — збільшити фото`}
          >
            <Image
              src={current || '/placeholder.svg'}
              alt={alt}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 620px"
              className="object-contain p-4"
            />
            <span className="absolute bottom-3 right-3 hidden rounded-full bg-background/80 p-2 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 lg:block">
              <ZoomIn className="size-4" />
            </span>
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">{noPhotoLabel}</div>
        )}

        {/* Prev / next arrows on the main image (visible on hover on desktop, always on mobile) */}
        {count > 1 && current && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Попереднє фото"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2 text-foreground shadow-sm transition hover:bg-background lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Наступне фото"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-2 text-foreground shadow-sm transition hover:bg-background lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Photo counter (mobile, like professional marketplaces) */}
        {count > 1 && current && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground shadow-sm lg:hidden">
            {safeActive + 1} / {count}
          </span>
        )}

        {/* Dot indicators (mobile only) */}
        {count > 1 && count <= 8 && current && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 lg:hidden">
            {gallery.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  i === safeActive ? 'bg-primary' : 'bg-foreground/20',
                )}
              />
            ))}
          </div>
        )}

        {discount > 0 && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-sm font-semibold text-destructive-foreground">
            -{discount}%
          </span>
        )}
      </div>

      {lightboxOpen && current ? (
        <Lightbox
          gallery={gallery}
          alt={alt}
          index={safeActive}
          onIndexChange={setActive}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------- Lightbox -------------------------------- */
// Fullscreen viewer like prom.ua: dark backdrop, arrows, thumbnail strip and
// click-to-zoom (zooms into the clicked point, click again to zoom out).

function Lightbox({
  gallery,
  alt,
  index,
  onIndexChange,
  onClose,
}: {
  gallery: string[]
  alt: string
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const frameRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  const count = gallery.length
  const prev = useCallback(() => {
    setZoomed(false)
    onIndexChange((index - 1 + count) % count)
  }, [index, count, onIndexChange])
  const next = useCallback(() => {
    setZoomed(false)
    onIndexChange((index + 1) % count)
  }, [index, count, onIndexChange])

  // Keyboard: Escape closes, arrows navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) prev()
      else if (e.key === 'ArrowRight' && count > 1) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, count])

  // Lock page scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // Zoom into the clicked point; second click zooms back out.
  function toggleZoom(e: React.MouseEvent<HTMLDivElement>) {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    if (!zoomed) {
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setOrigin(`${x}% ${y}%`)
      setZoomed(true)
    } else {
      setZoomed(false)
    }
  }

  // When zoomed, pan the image by moving the mouse (like prom.ua).
  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomed) return
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigin(`${x}% ${y}%`)
  }

  // Basic swipe navigation on touch devices (only when not zoomed).
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (zoomed || touchStartX.current === null || count < 2) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 50) prev()
    else if (dx < -50) next()
    touchStartX.current = null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити"
          className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Попереднє фото"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:left-4 md:p-3"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        <div
          ref={frameRef}
          onClick={toggleZoom}
          onMouseMove={onMouseMove}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className={cn(
            'relative h-full max-h-[70vh] w-full max-w-4xl overflow-hidden',
            zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
          )}
        >
          <Image
            src={gallery[index] || '/placeholder.svg'}
            alt={alt}
            fill
            sizes="100vw"
            className={cn(
              'select-none object-contain transition-transform duration-200',
              zoomed ? 'scale-[2.5]' : 'scale-100',
            )}
            style={{ transformOrigin: origin }}
            draggable={false}
          />
        </div>

        {count > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Наступне фото"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:right-4 md:p-3"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <div
          className="flex justify-center gap-2 overflow-x-auto p-3"
          onClick={(e) => e.stopPropagation()}
        >
          {gallery.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => {
                setZoomed(false)
                onIndexChange(i)
              }}
              aria-label={`${alt} — ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'relative size-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition',
                i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <Image src={src || '/placeholder.svg'} alt="" fill sizes="56px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

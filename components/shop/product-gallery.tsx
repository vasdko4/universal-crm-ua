'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'

type Props = {
  images: string[]
  alt: string
  discount?: number
  noPhotoLabel: string
  selectedImage?: string | null
}

export function ProductGallery({ images, alt, discount = 0, noPhotoLabel, selectedImage }: Props) {
  const { dict } = useI18n()
  const gallery = images.filter(Boolean)
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const thumbStripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

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
  const safeActive = Math.min(active, Math.max(count - 1, 0))
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

  useEffect(() => {
    const el = thumbRefs.current[safeActive]
    const strip = thumbStripRef.current
    if (!el || !strip) return
    const left = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [safeActive])

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
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) prev()
    else next()
  }

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
    <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-start lg:gap-3">
      {hasThumbs && (
        <div
          ref={thumbStripRef}
          className="order-2 flex gap-1.5 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:order-1 lg:max-h-[min(100%,560px)] lg:w-[72px] lg:shrink-0 lg:flex-col lg:gap-2 lg:overflow-y-auto lg:overflow-x-hidden lg:[scrollbar-width:thin] lg:[&::-webkit-scrollbar]:block"
        >
          {gallery.map((src, i) => (
            <button
              key={src + i}
              ref={(el) => {
                thumbRefs.current[i] = el
              }}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${alt} — ${i + 1}`}
              aria-current={i === safeActive}
              className={cn(
                'relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted/40 transition sm:size-16 lg:size-[68px]',
                i === safeActive
                  ? 'border-primary ring-2 ring-primary/25'
                  : 'border-transparent opacity-70 hover:border-border hover:opacity-100',
              )}
            >
              <Image
                src={src || '/placeholder.svg'}
                alt=""
                fill
                sizes="68px"
                quality={75}
                unoptimized={Boolean(src?.startsWith('/api/media'))}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div
        role="region"
        aria-label={alt}
        aria-roledescription="carousel"
        className="group relative order-1 min-w-0 flex-1 aspect-square overflow-hidden rounded-2xl border border-border bg-white outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:bg-card sm:aspect-[4/3] lg:order-2"
      >
        {current ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={onKeyDown}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="relative block h-full w-full cursor-zoom-in touch-pan-y"
            aria-label={`${alt} — ${dict.product.enlargePhoto}`}
          >
            <Image
              src={current || '/placeholder.svg'}
              alt={alt}
              fill
              priority
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized={Boolean(current?.startsWith('/api/media'))}
              className="object-contain"
            />
            <span className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full bg-background/90 p-2 text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 lg:inline-flex">
              <ZoomIn className="size-4" />
            </span>
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">{noPhotoLabel}</div>
        )}

        {count > 1 && current && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label={dict.common.previousPhoto}
              className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-sm transition hover:bg-background lg:size-auto lg:p-2 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={dict.common.nextPhoto}
              className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-sm transition hover:bg-background lg:size-auto lg:p-2 lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {count > 1 && current && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium tabular-nums text-foreground shadow-sm">
            {safeActive + 1} / {count}
          </span>
        )}

        {discount > 0 && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-sm font-semibold text-destructive-foreground">
            −{discount}%
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
          labels={{
            close: dict.common.close,
            previousPhoto: dict.common.previousPhoto,
            nextPhoto: dict.common.nextPhoto,
          }}
        />
      ) : null}
    </div>
  )
}

function Lightbox({
  gallery,
  alt,
  index,
  onIndexChange,
  onClose,
  labels,
}: {
  gallery: string[]
  alt: string
  index: number
  onIndexChange: (i: number) => void
  labels: { close: string; previousPhoto: string; nextPhoto: string }
  onClose: () => void
}) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const frameRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) prev()
      else if (e.key === 'ArrowRight' && count > 1) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, count])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  function toggleZoom(e: React.MouseEvent<HTMLButtonElement>) {
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

  function onMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (!zoomed) return
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigin(`${x}% ${y}%`)
  }

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
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[100] flex flex-col">
      <button
        type="button"
        aria-label={labels.close}
        className="absolute inset-0 bg-black/92"
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-between p-3 text-white">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
        >
          <X className="size-6" />
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 sm:px-12">
        {count > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label={labels.previousPhoto}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:left-4 md:p-3"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        <button
          type="button"
          ref={frameRef}
          onClick={toggleZoom}
          onMouseMove={onMouseMove}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label={zoomed ? labels.close : alt}
          className={cn(
            'relative h-full w-full max-w-5xl overflow-hidden border-0 bg-transparent p-0',
            zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
          )}
        >
          <Image
            src={gallery[index] || '/placeholder.svg'}
            alt={alt}
            fill
            quality={85}
            sizes="100vw"
            unoptimized={Boolean(gallery[index]?.startsWith('/api/media'))}
            className={cn(
              'select-none object-contain transition-transform duration-200',
              zoomed ? 'scale-[2.2]' : 'scale-100',
            )}
            style={{ transformOrigin: origin }}
            draggable={false}
          />
        </button>

        {count > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label={labels.nextPhoto}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:right-4 md:p-3"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="relative z-10 flex justify-center gap-2 overflow-x-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition',
                i === index ? 'border-primary' : 'border-transparent opacity-55 hover:opacity-100',
              )}
            >
              <Image src={src || '/placeholder.svg'} alt="" fill sizes="64px" unoptimized={Boolean(src?.startsWith('/api/media'))} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HeroSlide } from '@/lib/shop/home-hero-slides'

export function HomeHeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    if (n < 2 || paused) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % n), 5500)
    return () => window.clearInterval(id)
  }, [n, paused])

  if (n === 0) return null

  function go(delta: number) {
    setIndex((i) => (i + delta + n) % n)
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    startY.current = e.clientY
  }

  function onPointerUp(e: React.PointerEvent) {
    if (startX.current == null || startY.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    startX.current = null
    startY.current = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    go(dx < 0 ? 1 : -1)
  }

  return (
    <section
      className="border-b border-border bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-3 py-2 lg:px-8 lg:py-6">
        <div
          className="relative overflow-hidden rounded-2xl bg-neutral-900 text-white lg:rounded-3xl"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            startX.current = null
            startY.current = null
          }}
        >
          <div className="relative aspect-[2/1] w-full sm:aspect-[16/10] lg:aspect-[21/9]">
            {slides.map((slide, i) => {
              const nearby = i === index || i === (index + 1) % n || i === (index - 1 + n) % n
              if (!nearby) return null
              return (
              <div
                key={slide.title}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700',
                  i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
                aria-hidden={i !== index}
              >
                <Image
                  src={slide.image}
                  // Promo slides carry meaning (delivery / payment / warranty),
                  // so they get a real description instead of an empty alt.
                  // Admins can override it per slide; the headline is the
                  // sensible default.
                  alt={slide.imageAlt?.trim() || slide.title}
                  fill
                  priority={i === 0}
                  sizes="(max-width: 640px) 100vw, 1280px"
                  quality={70}
                  className="object-cover object-center"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/50 lg:to-black/15" />
                <div className="relative z-10 flex h-full flex-col justify-end gap-1.5 p-4 pb-8 sm:gap-3 sm:p-10 sm:pb-12 lg:p-12 lg:pb-14">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75 sm:text-xs">
                    {slide.badge}
                  </p>
                  {/* h2, not h1: the page keeps a single h1 about the store
                      itself (see app/(shop)/page.tsx). A carousel used to emit
                      one h1 per slide, so the homepage shipped 3-4 of them. */}
                  <h2 className="max-w-2xl text-balance text-[1.2rem] font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                    {slide.title}
                  </h2>
                  <p className="max-w-xl text-pretty text-xs leading-snug text-white/90 sm:text-base">
                    {slide.text}
                  </p>
                  {i === index ? (
                    <Button asChild size="lg" variant="secondary" className="mt-1 h-10 w-fit rounded-full sm:mt-3">
                      <Link href={slide.href}>
                        {slide.cta} <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            )})}
          </div>

          {n > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 sm:left-3 sm:flex"
                aria-label="Previous"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 sm:right-3 sm:flex"
                aria-label="Next"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-2 sm:bottom-5">
                {slides.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-8 bg-white' : 'w-3 bg-white/40')}
                    aria-label={s.badge}
                    aria-current={i === index}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

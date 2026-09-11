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
  }

  function onPointerUp(e: React.PointerEvent) {
    if (startX.current == null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (Math.abs(dx) < 40) return
    go(dx < 0 ? 1 : -1)
  }

  return (
    <section
      className="border-b border-border bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-3 py-3 lg:px-8 lg:py-6">
        <div
          className="relative overflow-hidden rounded-2xl bg-neutral-900 text-white lg:rounded-3xl"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            startX.current = null
          }}
        >
          <div className="relative min-h-[16.5rem] sm:min-h-[22rem] lg:min-h-[28rem]">
            {slides.map((slide, i) => (
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
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 lg:bg-gradient-to-r lg:from-black/80 lg:via-black/55 lg:to-black/20" />
                <div className="relative z-10 flex h-full min-h-[16.5rem] flex-col justify-end p-4 sm:min-h-[22rem] sm:p-10 lg:min-h-[28rem] lg:p-12">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75 sm:text-xs">
                    {slide.badge}
                  </p>
                  <h1 className="mt-2 max-w-2xl text-balance text-xl font-bold tracking-tight sm:mt-3 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                    {slide.title}
                  </h1>
                  <p className="mt-2 max-w-xl text-pretty text-xs text-white/90 sm:mt-3 sm:text-base">
                    {slide.text}
                  </p>
                  {i === index ? (
                    <Button asChild size="lg" variant="secondary" className="mt-4 h-10 w-fit rounded-full sm:mt-6">
                      <Link href={slide.href}>
                        {slide.cta} <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {n > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 sm:flex"
                aria-label="Previous"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 sm:flex"
                aria-label="Next"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute bottom-3 left-4 z-20 flex gap-2 sm:bottom-5 sm:left-10 lg:left-12">
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

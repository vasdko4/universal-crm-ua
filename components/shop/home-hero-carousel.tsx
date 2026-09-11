'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (n < 2 || paused) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % n), 5500)
    return () => window.clearInterval(id)
  }, [n, paused])

  if (n === 0) return null

  function go(delta: number) {
    setIndex((i) => (i + delta + n) % n)
  }

  return (
    <section
      className="border-b border-border bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8 lg:py-6">
        <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white">
          <div className="relative min-h-[22rem] sm:min-h-[26rem] lg:min-h-[28rem]">
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
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
                <div className="relative z-10 flex h-full min-h-[22rem] flex-col justify-end p-6 sm:min-h-[26rem] sm:p-10 lg:min-h-[28rem] lg:p-12">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">{slide.badge}</p>
                  <h1 className="mt-3 max-w-2xl text-balance text-2xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                    {slide.title}
                  </h1>
                  <p className="mt-3 max-w-xl text-pretty text-sm text-white/90 sm:text-base">{slide.text}</p>
                  {i === index ? (
                    <Button asChild size="lg" variant="secondary" className="mt-6 w-fit rounded-full">
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
              <div className="absolute bottom-5 left-6 z-20 flex gap-2 sm:left-10 lg:left-12">
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

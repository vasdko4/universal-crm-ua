'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type HomeBenefitItem, type HomeHeroSlide } from '@/app/actions/settings-store'
import type { SectionProps } from './settings-types'
import { ImageField } from './image-field'

const EMPTY_SLIDE: HomeHeroSlide = {
  image: '',
  href: '',
  uk: { badge: '', title: '', text: '', cta: '' },
  ru: { badge: '', title: '', text: '', cta: '' },
}

export function HomepageSection({ data, setData, t }: SectionProps) {
  const [locale, setLocale] = useState<'uk' | 'ru'>('uk')
  const slides = data.homeHero.slides?.length ? data.homeHero.slides : [EMPTY_SLIDE, EMPTY_SLIDE, EMPTY_SLIDE, EMPTY_SLIDE]

  function setSlides(next: HomeHeroSlide[]) {
    setData((d) => ({
      ...d,
      homeHero: { ...d.homeHero, slides: next },
    }))
  }

  function patchSlide(i: number, patch: Partial<HomeHeroSlide>) {
    const next = slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    setSlides(next)
  }

  function patchSlideLocale(i: number, patch: Partial<HomeHeroSlide['uk']>) {
    const slide = slides[i]
    patchSlide(i, { [locale]: { ...slide[locale], ...patch } })
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.heroTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.heroDesc}</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(['uk', 'ru'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              locale === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l === 'uk' ? t.localeUk : t.localeRu}
          </button>
        ))}
      </div>

      {slides.map((slide, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.heroTitleLabel} {i + 1}
          </p>
          <ImageField
            t={t}
            label={t.heroImageLabel}
            hint={t.heroImageHint}
            value={slide.image || null}
            onChange={(v) => patchSlide(i, { image: v ?? '' })}
            size={72}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`slide-badge-${i}`}>{t.heroBadgeLabel}</Label>
            <Input
              id={`slide-badge-${i}`}
              value={slide[locale].badge}
              onChange={(e) => patchSlideLocale(i, { badge: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`slide-title-${i}`}>{t.heroTitleLabel}</Label>
            <Input
              id={`slide-title-${i}`}
              value={slide[locale].title}
              onChange={(e) => patchSlideLocale(i, { title: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`slide-text-${i}`}>{t.heroTextLabel}</Label>
            <Input
              id={`slide-text-${i}`}
              value={slide[locale].text}
              onChange={(e) => patchSlideLocale(i, { text: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`slide-cta-${i}`}>{t.heroButtonLabel}</Label>
            <Input
              id={`slide-cta-${i}`}
              value={slide[locale].cta}
              onChange={(e) => patchSlideLocale(i, { cta: e.target.value })}
            />
          </div>
        </div>
      ))}

      <div>
        <h2 className="text-base font-semibold text-foreground">{t.benefitsTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.benefitsDesc}</p>
      </div>

      {data.homeBenefits[locale].map((item, i) => {
        function patchBenefit(patch: Partial<HomeBenefitItem>) {
          setData((d) => ({
            ...d,
            homeBenefits: {
              ...d.homeBenefits,
              [locale]: d.homeBenefits[locale].map((it, idx) =>
                idx === i ? { ...it, ...patch } : it,
              ) as HomeBenefitItem[],
            },
          }))
        }
        return (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <ImageField
              t={t}
              label={t.benefitIconLabel}
              hint={t.benefitIconHint}
              value={item.iconUrl || null}
              onChange={(v) => patchBenefit({ iconUrl: v })}
              size={56}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`benefit-title-${i}`}>{t.benefitTitleLabel}</Label>
              <Input
                id={`benefit-title-${i}`}
                value={item.title}
                onChange={(e) => patchBenefit({ title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`benefit-text-${i}`}>{t.benefitTextLabel}</Label>
              <Input
                id={`benefit-text-${i}`}
                value={item.text}
                onChange={(e) => patchBenefit({ text: e.target.value })}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

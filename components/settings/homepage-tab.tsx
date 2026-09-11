'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type HomeBenefitItem } from '@/app/actions/settings-store'
import type { SectionProps } from './settings-types'
import { ImageField } from './image-field'

export function HomepageSection({ data, setData, t }: SectionProps) {
  const [locale, setLocale] = useState<'uk' | 'ru'>('uk')

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.benefitsTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.benefitsDesc}</p>
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

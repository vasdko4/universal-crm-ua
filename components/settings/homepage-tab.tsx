'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Store,
  Share2,
  Mail,
  BarChart3,
  ImageIcon,
  Loader2,
  Save,
  Palette,
  Check,
  Globe,
  Phone,
  Plus,
  Trash2,
  Clock,
  MapPin,
  MessageCircle,
  Power,
  Search,
  Bell,
  Send,
  Upload,
  X,
  KeyRound,
  Eye,
  EyeOff,
  LayoutTemplate,
} from 'lucide-react'
import { TEMPLATES } from '@/lib/shop/templates'
import { cn } from '@/lib/utils'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { useClientOrigin } from '@/lib/hooks/use-client-only'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  clearSiteCache,
  updateStoreSettings,
  type HomeHeroLocaleContent,
  type HomeBenefitItem,
  type StoreSettingsData,
  type WeekDay,
  type WidgetChannelKey,
} from '@/app/actions/settings-store'
import type { SectionProps } from './settings-types'
import { ImageField } from './image-field'

export function HomepageSection({ data, setData, t }: SectionProps) {
  const [heroLocale, setHeroLocale] = useState<'uk' | 'ru'>('uk')

  function setHero(field: keyof HomeHeroLocaleContent, value: string) {
    setData((d) => ({
      ...d,
      homeHero: {
        ...d.homeHero,
        [heroLocale]: { ...d.homeHero[heroLocale], [field]: value },
      },
    }))
  }

  const hero = data.homeHero[heroLocale]
  const ph =
    heroLocale === 'uk'
      ? {
          badge: 'Магазин',
          title: 'Доставка, оплата і гарантія — без сюрпризів',
          text: 'Нова Пошта по Україні, картка або наложка…',
          buttonText: 'До каталогу',
        }
      : {
          badge: 'Магазин',
          title: 'Доставка, оплата и гарантия — без сюрпризов',
          text: 'Новая Почта по Украине, карта или наложенный платёж…',
          buttonText: 'В каталог',
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
            onClick={() => setHeroLocale(l)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              heroLocale === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l === 'uk' ? t.localeUk : t.localeRu}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-badge">{t.heroBadgeLabel}</Label>
        <p className="text-xs text-muted-foreground">{t.heroBadgeHint}</p>
        <Input id="hero-badge" value={hero.badge} onChange={(e) => setHero('badge', e.target.value)} placeholder={ph.badge} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-title">{t.heroTitleLabel}</Label>
        <Input id="hero-title" value={hero.title} onChange={(e) => setHero('title', e.target.value)} placeholder={ph.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-text">{t.heroTextLabel}</Label>
        <Textarea id="hero-text" rows={3} value={hero.text} onChange={(e) => setHero('text', e.target.value)} placeholder={ph.text} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-btn">{t.heroButtonLabel}</Label>
        <p className="text-xs text-muted-foreground">{t.heroButtonHint}</p>
        <Input id="hero-btn" value={hero.buttonText} onChange={(e) => setHero('buttonText', e.target.value)} placeholder={ph.buttonText} />
      </div>

      <ImageField
        t={t}
        label={t.heroImageLabel}
        hint={t.heroImageHint}
        value={data.homeHero.imageUrl || null}
        onChange={(v) => setData((d) => ({ ...d, homeHero: { ...d.homeHero, imageUrl: v } }))}
      />

      <div className="mt-4 flex flex-col gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t.benefitsTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.benefitsDesc}</p>
        </div>
        {data.homeBenefits[heroLocale].map((item, i) => {
          function patchBenefit(patch: Partial<HomeBenefitItem>) {
            setData((d) => ({
              ...d,
              homeBenefits: {
                ...d.homeBenefits,
                [heroLocale]: d.homeBenefits[heroLocale].map((it, idx) =>
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
    </div>
  )
}

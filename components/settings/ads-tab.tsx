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

export function AdsSection({ data, setData, t }: SectionProps) {
  const g = data.googleAds
  const set = (patch: Partial<StoreSettingsData['googleAds']>) =>
    setData((d) => ({ ...d, googleAds: { ...d.googleAds, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.convTitle}</p>
          <p className="text-xs text-muted-foreground">{t.convDesc}</p>
        </div>
        <Switch checked={g.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.conversionIdLabel}</Label>
        <Input
          value={g.conversionId}
          placeholder="AW-XXXXXXXXX"
          onChange={(e) => set({ conversionId: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.conversionLabelLabel}</Label>
        <Input
          value={g.conversionLabel}
          onChange={(e) => set({ conversionLabel: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.enhancedConvTitle}</p>
          <p className="text-xs text-muted-foreground">{t.enhancedConvDesc}</p>
        </div>
        <Switch
          checked={g.enhancedConversionsEnabled}
          onCheckedChange={(v) => set({ enhancedConversionsEnabled: v })}
        />
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t.gaTitle}</p>
            <p className="text-xs text-muted-foreground">{t.gaDesc}</p>
          </div>
          <Switch checked={g.gaEnabled} onCheckedChange={(v) => set({ gaEnabled: v })} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Label>{t.gaMeasurementLabel}</Label>
          <Input
            value={g.gaMeasurementId}
            placeholder="G-XXXXXXXXXX"
            onChange={(e) => set({ gaMeasurementId: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t.gaHint}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">{t.merchantTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.merchantDesc}</p>
        <MerchantFeedUrl siteUrl={data.seo.siteUrl} t={t} />
        <p className="mt-2 text-xs text-muted-foreground">{t.merchantLocaleNote}</p>
        <MerchantFeedFields data={data} setData={setData} t={t} />
      </div>
    </div>
  )
}

function MerchantFeedFields({ data, setData, t }: SectionProps) {
  const m = data.merchantFeed
  const set = (patch: Partial<StoreSettingsData['merchantFeed']>) =>
    setData((d) => ({ ...d, merchantFeed: { ...d.merchantFeed, ...patch } }))

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-col gap-2">
        <Label>{t.merchantCategoryLabel}</Label>
        <Input
          value={m.googleProductCategory}
          placeholder={t.merchantCategoryPlaceholder}
          onChange={(e) => set({ googleProductCategory: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.merchantCategoryHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t.merchantShippingPriceLabel}</Label>
          <Input
            value={m.shippingPrice}
            placeholder={t.merchantShippingPricePlaceholder}
            onChange={(e) => set({ shippingPrice: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.merchantShippingCountryLabel}</Label>
          <Input
            value={m.shippingCountry}
            placeholder="UA"
            onChange={(e) => set({ shippingCountry: e.target.value.toUpperCase().slice(0, 2) })}
          />
        </div>
      </div>
    </div>
  )
}

function MerchantFeedUrl({ siteUrl, t }: { siteUrl: string; t: AdminDictionary['settings'] }) {
  const origin = useClientOrigin()
  const base = siteUrl?.trim() || origin
  const url = base ? `${base.replace(/\/+$/, '')}/feed/google-merchant.xml` : ''

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(url)
          toast.success(t.toastCopied)
        }}
      >
        {t.copyButton}
      </Button>
    </div>
  )
}

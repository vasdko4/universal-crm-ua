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

export function SeoSection({ data, setData, t }: SectionProps) {
  const seo = data.seo
  const setSeo = (patch: Partial<StoreSettingsData['seo']>) =>
    setData((d) => ({ ...d, seo: { ...d.seo, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-domain">{t.domainLabel}</Label>
        <Input
          id="seo-domain"
          value={seo.siteUrl}
          placeholder="https://mystore.com"
          inputMode="url"
          onChange={(e) => setSeo({ siteUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.domainHint}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-title">{t.metaTitleLabel}</Label>
        <Input
          id="seo-title"
          value={seo.metaTitle}
          maxLength={70}
          placeholder={`${data.storeName || t.storeNameLabel} ${t.onlineStoreSuffix}`}
          onChange={(e) => setSeo({ metaTitle: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{seo.metaTitle.length}/70 {t.charsCount}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-desc">{t.metaDescLabel}</Label>
        <Textarea
          id="seo-desc"
          rows={3}
          maxLength={170}
          value={seo.metaDescription}
          placeholder={t.metaDescPlaceholder}
          onChange={(e) => setSeo({ metaDescription: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{seo.metaDescription.length}/170 {t.charsCount}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-keywords">{t.keywordsLabel}</Label>
        <Input
          id="seo-keywords"
          value={seo.keywords}
          placeholder={t.keywordsPlaceholder}
          onChange={(e) => setSeo({ keywords: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.keywordsHint}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-gsc">Google Search Console</Label>
        <Input
          id="seo-gsc"
          value={seo.googleVerification}
          placeholder={t.gscPlaceholder}
          onChange={(e) => setSeo({ googleVerification: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.gscHint}</p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.indexingTitle}</p>
          <p className="text-xs text-muted-foreground">{t.indexingDesc}</p>
        </div>
        <Switch
          checked={seo.indexingEnabled}
          onCheckedChange={(v) => setSeo({ indexingEnabled: v })}
        />
      </div>
      <ImageField
        t={t}
        label={t.ogImageLabel}
        hint={t.ogImageHint}
        value={seo.ogImageUrl}
        onChange={(v) => setSeo({ ogImageUrl: v })}
      />
    </div>
  )
}

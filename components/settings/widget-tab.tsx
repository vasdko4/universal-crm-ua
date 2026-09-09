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

export function WidgetSection({ data, setData, t }: SectionProps) {
  const WIDGET_CHANNELS = getWidgetChannels(t)
  const w = data.contact.widget
  const setWidget = (patch: Partial<StoreSettingsData['contact']['widget']>) =>
    setData((d) => ({ ...d, contact: { ...d.contact, widget: { ...d.contact.widget, ...patch } } }))
  const setChannel = (key: WidgetChannelKey, patch: Partial<{ value: string; enabled: boolean }>) =>
    setWidget({ channels: { ...w.channels, [key]: { ...w.channels[key], [Object.keys(patch)[0]]: Object.values(patch)[0] } } })

  const allOn = WIDGET_CHANNELS.every(({ key }) => w.channels[key].enabled)
  const toggleAll = (on: boolean) => {
    const channels = { ...w.channels }
    for (const { key } of WIDGET_CHANNELS) channels[key] = { ...channels[key], enabled: on }
    setWidget({ channels })
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {/* Master toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.widgetTitle}</p>
          <p className="text-xs text-muted-foreground">{t.widgetDesc}</p>
        </div>
        <Switch checked={w.enabled} onCheckedChange={(v) => setWidget({ enabled: v })} />
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">{t.channelsLabel}</span>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => toggleAll(true)} disabled={allOn}>
          <Power className="size-4" /> {t.enableAllButton}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => toggleAll(false)}>
          <Power className="size-4" /> {t.disableAllButton}
        </Button>
      </div>

      {/* Channels */}
      <div className="flex flex-col gap-3">
        {WIDGET_CHANNELS.map(({ key, label, placeholder, hint }) => {
          const ch = w.channels[key]
          return (
            <div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={ch.enabled} onCheckedChange={(v) => setChannel(key, { enabled: v })} />
              </div>
              <Input
                value={ch.value}
                placeholder={placeholder}
                onChange={(e) => setChannel(key, { value: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t.widgetFootnote}</p>
    </div>
  )
}

const SOCIALS: { key: keyof StoreSettingsData['social']; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'viber', label: 'Viber' },
  { key: 'tiktok', label: 'TikTok' },
]

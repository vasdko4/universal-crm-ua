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

export function GeneralSection({ data, setData, t }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-name">{t.storeNameLabel}</Label>
        <Input
          id="s-name"
          value={data.storeName}
          onChange={(e) => setData((d) => ({ ...d, storeName: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-desc">{t.storeDescLabel}</Label>
        <Textarea
          id="s-desc"
          rows={3}
          value={data.storeDescription ?? ''}
          onChange={(e) => setData((d) => ({ ...d, storeDescription: e.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.openCartTitle}</p>
          <p className="text-xs text-muted-foreground">{t.openCartDesc}</p>
        </div>
        <Switch
          checked={data.openCartAfterAdd}
          onCheckedChange={(v) => setData((d) => ({ ...d, openCartAfterAdd: v }))}
        />
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t.minOrderTitle}</p>
            <p className="text-xs text-muted-foreground">{t.minOrderDesc}</p>
          </div>
          <Switch
            checked={data.minOrder.enabled}
            onCheckedChange={(v) => setData((d) => ({ ...d, minOrder: { ...d.minOrder, enabled: v } }))}
          />
        </div>
        {data.minOrder.enabled && (
          <div className="mt-3 flex flex-col gap-2">
            <Label>{t.minOrderAmountLabel}</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={data.minOrder.amount || ''}
              placeholder="500"
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  minOrder: { ...d.minOrder, amount: Math.max(0, Number(e.target.value) || 0) },
                }))
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Hero-блок главной страницы: бейдж, заголовок, описание, текст кнопки для
// каждого языка + картинка. Пустое поле = встроенный текст по умолчанию.

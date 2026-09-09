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

export function SystemSection({ t }: { t: AdminDictionary['settings'] }) {
  const [clearing, startClearing] = useTransition()

  function handleClearCache() {
    startClearing(async () => {
      try {
        await clearSiteCache()
        toast.success(t.toastCacheCleared)
      } catch {
        toast.error(t.toastCacheClearError)
      }
    })
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.cacheTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.cacheDesc}</p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.clearCacheLabel}</p>
          <p className="text-xs text-muted-foreground">{t.clearCacheHint}</p>
        </div>
        <Button variant="outline" onClick={handleClearCache} disabled={clearing}>
          {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {t.clearCacheButton}
        </Button>
      </div>
    </div>
  )
}

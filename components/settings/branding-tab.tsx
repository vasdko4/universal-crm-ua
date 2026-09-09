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

export function BrandingSection({ data, setData, t }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <ImageField
        t={t}
        label={t.logoLabel}
        hint={t.logoHint}
        value={data.logoUrl}
        onChange={(v) => setData((d) => ({ ...d, logoUrl: v }))}
      />
      <ImageField
        t={t}
        label={t.faviconLabel}
        hint={t.faviconHint}
        value={data.faviconUrl}
        onChange={(v) => setData((d) => ({ ...d, faviconUrl: v }))}
        size={48}
      />
    </div>
  )
}

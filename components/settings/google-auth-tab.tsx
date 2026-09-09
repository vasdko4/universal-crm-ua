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

export function GoogleAuthSection({ data, setData, t }: SectionProps) {
  const g = data.googleAuth
  const set = (patch: Partial<StoreSettingsData['googleAuth']>) =>
    setData((d) => ({ ...d, googleAuth: { ...d.googleAuth, ...patch } }))
  const [showSecret, setShowSecret] = useState(false)
  const configured = Boolean(g.clientId.trim() && g.clientSecret.trim())

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.googleAuthTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.googleAuthDescPrefix}{' '}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t.googleAuthDescLink}
          </a>{' '}
          {t.googleAuthDescSuffix}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.googleAuthToggleTitle}</p>
          <p className="text-xs text-muted-foreground">
            {configured ? t.googleAuthToggleConfigured : t.googleAuthToggleNotConfigured}
          </p>
        </div>
        <Switch
          checked={g.enabled}
          disabled={!configured && !g.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga-client-id">{t.clientIdLabel}</Label>
        <Input
          id="ga-client-id"
          name="google-oauth-client-id"
          value={g.clientId}
          placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          onChange={(e) => set({ clientId: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga-client-secret">{t.clientSecretLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ga-client-secret"
            name="google-oauth-client-secret"
            type={showSecret ? 'text' : 'password'}
            value={g.clientSecret}
            placeholder="GOCSPX-..."
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            onChange={(e) => set({ clientSecret: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showSecret ? t.hideSecretAria : t.showSecretAria}
            onClick={() => setShowSecret((v) => !v)}
          >
            {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.secretHint}</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground">{t.redirectTitle}</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {typeof window !== 'undefined'
            ? `${window.location.origin}/api/auth/callback/google`
            : '/api/auth/callback/google'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t.redirectHint}</p>
      </div>
    </div>
  )
}

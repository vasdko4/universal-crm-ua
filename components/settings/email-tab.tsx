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

export function EmailSection({ data, setData, t }: SectionProps) {
  const e = data.emailSettings
  const set = (patch: Partial<StoreSettingsData['emailSettings']>) =>
    setData((d) => ({ ...d, emailSettings: { ...d.emailSettings, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.emailToggleTitle}</p>
          <p className="text-xs text-muted-foreground">{t.emailToggleDesc}</p>
        </div>
        <Switch checked={e.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t.providerLabel}</Label>
          <Select value={e.provider} onValueChange={(v) => set({ provider: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gmail">Gmail</SelectItem>
              <SelectItem value="smtp">SMTP</SelectItem>
              <SelectItem value="sendgrid">SendGrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.fromNameLabel}</Label>
          <Input value={e.fromName} onChange={(ev) => set({ fromName: ev.target.value })} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.fromEmailLabel}</Label>
        <Input
          type="email"
          value={e.fromEmail}
          onChange={(ev) => set({ fromEmail: ev.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t.smtpHostLabel}</Label>
          <Input value={e.smtpHost} onChange={(ev) => set({ smtpHost: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.smtpPortLabel}</Label>
          <Input value={e.smtpPort} onChange={(ev) => set({ smtpPort: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.smtpUserLabel}</Label>
          <Input
            name="smtp-username"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            value={e.smtpUser}
            onChange={(ev) => set({ smtpUser: ev.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.smtpPasswordLabel}</Label>
          <Input
            type="password"
            name="smtp-password"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            value={e.smtpPassword}
            onChange={(ev) => set({ smtpPassword: ev.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.smtpTip}</p>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.dkimTitle}</p>
          <p className="text-xs text-muted-foreground">{t.dkimDesc}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>{t.dkimSelectorLabel}</Label>
            <Input
              placeholder="mail"
              value={e.dkimSelector}
              onChange={(ev) => set({ dkimSelector: ev.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.dkimKeyLabel}</Label>
            <Input
              type="password"
              name="dkim-private-key"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={e.dkimPrivateKey}
              onChange={(ev) => set({ dkimPrivateKey: ev.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">{t.dnsBoxTitle}</p>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">SPF</span> — {t.dnsSpf}
          </li>
          <li>
            <span className="font-semibold text-foreground">DKIM</span> — {t.dnsDkim}
          </li>
          <li>
            <span className="font-semibold text-foreground">DMARC</span> — {t.dnsDmarc}
          </li>
          <li>
            <span className="font-semibold text-foreground">{t.dnsImportantLabel}</span> — {t.dnsImportant}
          </li>
        </ul>
      </div>
    </div>
  )
}

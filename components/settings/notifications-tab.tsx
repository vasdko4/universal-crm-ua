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

export function NotificationsSection({ data, setData, t }: SectionProps) {
  const n = data.notifications
  const set = (patch: Partial<StoreSettingsData['notifications']>) =>
    setData((d) => ({ ...d, notifications: { ...d.notifications, ...patch } }))
  const [testing, setTesting] = useState(false)

  async function testTelegram() {
    setTesting(true)
    try {
      const { sendTestTelegram } = await import('@/app/actions/notifications')
      const res = await sendTestTelegram({ botToken: n.telegramBotToken, chatId: n.telegramChatId })
      if (res.success) toast.success(t.toastTelegramSent)
      else toast.error(res.error ?? t.toastTelegramError)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-foreground">{t.notifSectionTitle}</p>
        <p className="text-xs text-muted-foreground">{t.notifSectionDesc}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.customerEmailTitle}</p>
          <p className="text-xs text-muted-foreground">{t.customerEmailDesc}</p>
        </div>
        <Switch
          checked={n.customerEmailEnabled}
          onCheckedChange={(v) => set({ customerEmailEnabled: v })}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t.adminEmailTitle}</p>
            <p className="text-xs text-muted-foreground">{t.adminEmailDesc}</p>
          </div>
          <Switch checked={n.adminEmailEnabled} onCheckedChange={(v) => set({ adminEmailEnabled: v })} />
        </div>
        {n.adminEmailEnabled && (
          <div className="flex flex-col gap-2">
            <Label>{t.adminEmailLabel}</Label>
            <Input
              type="email"
              value={n.adminEmail}
              placeholder={t.adminEmailPlaceholder}
              onChange={(ev) => set({ adminEmail: ev.target.value })}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t.telegramTitle}</p>
            <p className="text-xs text-muted-foreground">{t.telegramDesc}</p>
          </div>
          <Switch checked={n.telegramEnabled} onCheckedChange={(v) => set({ telegramEnabled: v })} />
        </div>
        {n.telegramEnabled && (
          <>
            <div className="flex flex-col gap-2">
              <Label>{t.telegramTokenLabel}</Label>
              <Input
                type="password"
                name="telegram-bot-token"
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-form-type="other"
                value={n.telegramBotToken}
                placeholder="123456789:AAF..."
                onChange={(ev) => set({ telegramBotToken: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t.telegramTokenHint}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.telegramChatIdLabel}</Label>
              <Input
                value={n.telegramChatId}
                placeholder={t.telegramChatIdPlaceholder}
                onChange={(ev) => set({ telegramChatId: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t.telegramChatIdHint}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={testTelegram}
              disabled={testing || !n.telegramBotToken || !n.telegramChatId}
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t.testButton}
            </Button>
            <p className="text-xs text-muted-foreground">{t.testNote}</p>
          </>
        )}
      </div>
    </div>
  )
}
